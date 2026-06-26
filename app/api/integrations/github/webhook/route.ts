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
  /*
   * Step 0: Read raw body (needed for signature verification)
   */
  const rawBody = await request.text();

  /*
   * Step 1: Signature verification
   * Reject forged webhooks before doing any other work.
   */
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery") || "";
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
   * Step 2: Replay protection — check for duplicate delivery BEFORE rate limiting
   * and before any processing work. This prevents replayed webhooks from
   * consuming resources even if the same delivery is sent multiple times.
   * Uses the raw deliveryId as the idempotency key for the early check;
   * the full key (including action) is used after payload parsing.
   */
  if (deliveryId) {
    const earlyKey = `webhook:${deliveryId}`;
    const acquired = await tryAcquireIdempotency(earlyKey, 86_400_000);
    if (!acquired) {
      return NextResponse.json(
        { ok: true, ignored: true, reason: "duplicate_delivery" },
        { status: 200 },
      );
    }
  }

  /*
   * Step 3: Rate limiting
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
    }
    if (deliveryId) {
      await releaseIdempotency(`webhook:${deliveryId}`);
    }
    return NextResponse.json({ ok: true, message: "Webhook accepted and queued to DLQ due to severe outages" }, { status: 202 });
  }

  if (!rl.allowed) {
    if (deliveryId) {
      await releaseIdempotency(`webhook:${deliveryId}`);
    }
    return rateLimitResponse(rl, "Webhook rate limit exceeded");
  }

  /*
   * Step 4: Event routing — only process events we handle
   */
  if (event !== "pull_request" && event !== "issues" && event !== "push") {
    if (deliveryId) {
      await releaseIdempotency(`webhook:${deliveryId}`);
    }
    return NextResponse.json(
      { ok: true, ignored: true, event },
      { status: 200 },
    );
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    if (deliveryId) {
      await releaseIdempotency(`webhook:${deliveryId}`);
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = payload.action;

  if (event === "pull_request") {
    if (!shouldHandlePullRequestAction(action)) {
      if (deliveryId) {
        await releaseIdempotency(`webhook:${deliveryId}`);
      }
      return NextResponse.json(
        { ok: true, ignored: true, action },
        { status: 200 },
      );
    }
    if (payload.pull_request?.draft && action !== "ready_for_review") {
      if (deliveryId) {
        await releaseIdempotency(`webhook:${deliveryId}`);
      }
      return NextResponse.json(
        { ok: true, ignored: true, reason: "draft" },
        { status: 200 },
      );
    }
  } else if (event === "issues") {
    if (!shouldHandleIssueAction(action)) {
      if (deliveryId) {
        await releaseIdempotency(`webhook:${deliveryId}`);
      }
      return NextResponse.json(
        { ok: true, ignored: true, action },
        { status: 200 },
      );
    }
  }

  /*
   * Step 5: Bot filtering
   */
  if (payload.sender?.type === "Bot") {
    if (deliveryId) {
      await releaseIdempotency(`webhook:${deliveryId}`);
    }
    return NextResponse.json(
      { ok: true, ignored: true, reason: "bot" },
      { status: 200 },
    );
  }

  /*
   * Step 6: Field validation
   */
  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const number = payload.pull_request?.number || payload.issue?.number;
  const installationId = payload.installation?.id;

  if (!owner || !repo || (!number && event !== "push") || !installationId) {
    if (deliveryId) {
      await releaseIdempotency(`webhook:${deliveryId}`);
    }
    return NextResponse.json(
      {
        error: "Missing required fields",
        details: { owner, repo, number, installationId, event },
      },
      { status: 400 },
    );
  }

  /*
   * Step 7: Full idempotency check with action-aware key
   * Re-check with the full key (deliveryId + event + action) in case a different
   * event type for the same delivery slipped through the early check.
   */
  let idempotencyKey: string | null = null;
  if (deliveryId) {
    idempotencyKey = generateWebhookKey(deliveryId, event || "unknown", action);
    const acquired = await tryAcquireIdempotency(idempotencyKey);
    if (!acquired) {
      await releaseIdempotency(`webhook:${deliveryId}`);
      return NextResponse.json(
        { ok: true, ignored: true, reason: "duplicate_delivery" },
        { status: 200 },
      );
    }
  }

  /*
   * Step 8: Persist and enqueue
   */
  try {
    const baseUrl = process.env.NEXTAUTH_URL || `http://${request.headers.get("host") || "localhost:3000"}`;
    await webhookQueue.enqueueWebhook(payload, event || "unknown", action, baseUrl, deliveryId);

    webhookRetryService.requeueFailedJobs().catch(() => {});

    return NextResponse.json(
      { ok: true, message: "Webhook accepted and queued for processing" },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error queueing webhook event:", error);
    if (idempotencyKey) {
      await releaseIdempotency(idempotencyKey);
    }
    if (deliveryId) {
      await releaseIdempotency(`webhook:${deliveryId}`);
    }
    return NextResponse.json(
      { error: "Failed to queue webhook event" },
      { status: 500 }
    );
  }
}
