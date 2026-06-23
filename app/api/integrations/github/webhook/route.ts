import { NextRequest, NextResponse } from "next/server";
import { verifyGitHubWebhookSignature } from "@/lib/utils/githubWebhook";
import { GithubWebhookVerifier } from "@/lib/services/githubWebhookVerifier";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getClientIp } from "@/lib/services/rateLimitService";
import { SafeHttpClient } from "@/services/security/safe-http-client";
import { webhookQueue } from "@/lib/services/webhook-queue";
import { dbHealthService } from "@/lib/services/db-health";
import { webhookRetryService } from "@/lib/services/webhook-retry";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";
import { generateWebhookKey, tryAcquireIdempotency, releaseIdempotency } from "@/lib/utils/idempotency";

export const runtime = "nodejs";

/**
 * Shape of the parsed GitHub webhook payload.
 * Only the fields relevant to routing and downstream processing are declared.
 */
type WebhookPayload = {
  action?: string;
  installation?: { id?: number };
  repository?: {
    name?: string;
    owner?: { login?: string };
  };
  pull_request?: {
    number?: number;
    html_url?: string;
    draft?: boolean;
  };
  issue?: {
    number?: number;
    title?: string;
    body?: string;
    html_url?: string;
  };
  sender?: {
    type?: string;
    login?: string;
  };
};

/**
 * We only process PR events that materially change the diff or state:
 * - opened: new PR submitted
 * - reopened: closed PR brought back
 * - synchronize: new commits pushed to the branch
 * - ready_for_review: draft PR transitioned to non-draft
 */
function shouldHandlePullRequestAction(action: string | undefined): boolean {
  return (
    action === "opened" ||
    action === "reopened" ||
    action === "synchronize" ||
    action === "ready_for_review"
  );
}

/**
 * For issues, only process newly opened ones.
 * Comments, edits, and closures are ignored by this pipeline.
 */
function shouldHandleIssueAction(action: string | undefined): boolean {
  return action === "opened";
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  /*
   * Step 1: Signature verification
   * Verify HMAC-SHA256 BEFORE rate limiting. This prevents an attacker from
   * exhausting the webhook rate limit for a legitimate IP using forged requests.
   */
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const secret = process.env.GITHUB_WEBHOOK_SECRET || "";

  const isValid = await GithubWebhookVerifier.verifySignature(request, rawBody) || verifyGitHubWebhookSignature({
    rawBody,
    signature256Header: signature,
    webhookSecret: secret,
  });

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  /*
   * Step 2: Rate limiting
   * Apply per-IP rate limits after signature is validated.
   */
  const ip = getClientIp(request);
  const rl = await checkRateLimit(ip, RATE_LIMITS.GITHUB_WEBHOOK);

  if (rl.fallbackFailed) {
    console.error("[WebhookRoute] Rate limiters completely failed. DLQing webhook.");
    try {
      await prisma.webhookEvent.create({
        data: {
          event: event || "unknown",
          payload: rawBody,
          status: "dlq",
          error: "Rate limiter and fallback completely failed",
        },
      });
    } catch (e) {
      console.error("[WebhookRoute] Failed to write to DLQ!", e);
      // Return 503 so GitHub retries the webhook delivery.
      return NextResponse.json({ error: "Webhook processing failed. Please retry." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, message: "Webhook accepted and queued to DLQ due to severe outages" }, { status: 202 });
  }

  if (!rl.allowed) return rateLimitResponse(rl, "Webhook rate limit exceeded");

  /*
   * Step 3: Event routing — only process events we handle.
   * Unsupported event types (label, milestone, etc.) and non-material PR/issue
   * actions get a silent 200.
   */
  const deliveryId = request.headers.get("x-github-delivery") || "";

  if (event !== "pull_request" && event !== "issues" && event !== "push") {
    return NextResponse.json({ ok: true, message: "Event type not handled" }, { status: 200 });
  }

