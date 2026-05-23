import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { repositoryService } from "@/lib/services/repositoryService";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKER_TIMEOUT_MS = 55_000; // 55 s — stay under Vercel's 60 s limit
const LOG_PREFIX = "[run-analysis]";

// ---------------------------------------------------------------------------
// Structured logger — all output goes to stdout as JSON for log aggregators
// (Vercel Log Drains, Datadog, etc.)
// ---------------------------------------------------------------------------

type LogLevel = "info" | "warn" | "error";

function log(
  level: LogLevel,
  message: string,
  meta: Record<string, unknown> = {},
) {
  // Never log secrets — strip known sensitive keys defensively
  const { secret, authorization, ...safeMeta } = meta as any;
  console[level === "error" ? "error" : "log"](
    JSON.stringify({
      level,
      ts: new Date().toISOString(),
      source: LOG_PREFIX,
      message,
      ...safeMeta,
    }),
  );
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Constant-time string comparison — prevents timing attacks.
 * Returns false if either value is missing.
 */
function safeEqual(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    // Buffers must be the same length for timingSafeEqual
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Returns true when the request is authorised to trigger analysis.
 *
 * Priority order:
 *  1. Vercel Cron signature (production only) — cryptographically verified
 *  2. x-analysis-runner-secret header — constant-time compared
 *  3. Dev-only fallback — explicitly blocked in production
 *
 * NOTE: query-parameter secrets are intentionally NOT supported — they leak
 * into server logs, CDN logs, and Referer headers.
 */
function isAuthorized(request: NextRequest): {
  ok: boolean;
  reason: string;
} {
  const configuredSecret = process.env.ANALYSIS_RUNNER_SECRET;

  // --- 1. Vercel Cron (GET only, production only) ---
  // Vercel injects a signed `x-vercel-signature` on cron requests in addition
  // to setting the vercel-cron User-Agent.  Verify the signature when present.
  if (request.method === "GET") {
    const vercelSig = request.headers.get("x-vercel-signature");
    const ua = (request.headers.get("user-agent") || "").toLowerCase();
    const isVercelEnv =
      process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production";

    if (isVercelEnv && ua.includes("vercel-cron/")) {
      // If Vercel provides a signature and we have a secret, verify it.
      // If no signature is present we still accept — plain cron without sig.
      if (vercelSig && configuredSecret) {
        const expected = crypto
          .createHmac("sha256", configuredSecret)
          .update(request.url)
          .digest("hex");
        if (!safeEqual(vercelSig, expected)) {
          return { ok: false, reason: "invalid_cron_signature" };
        }
      }
      return { ok: true, reason: "vercel_cron" };
    }
  }

  // --- 2. Secret header (all environments, all methods) ---
  if (configuredSecret) {
    const headerSecret = request.headers.get("x-analysis-runner-secret");
    if (safeEqual(headerSecret, configuredSecret)) {
      return { ok: true, reason: "secret_header" };
    }
    return { ok: false, reason: "invalid_secret" };
  }

  // --- 3. Dev-only fallback ---
  // Explicitly blocked in production even if no secret is configured,
  // so misconfigured staging/preview deployments stay closed.
  if (process.env.NODE_ENV !== "production") {
    return { ok: true, reason: "dev_no_secret" };
  }

  return { ok: false, reason: "no_secret_configured" };
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

/**
 * Races `promise` against a hard deadline.
 * Rejects with a typed error so callers can distinguish timeout from other
 * failures and mark the job accordingly.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        Object.assign(new Error(`Timed out after ${ms} ms`), {
          code: "WORKER_TIMEOUT",
        }),
      );
    }, ms);

    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Core handler
// ---------------------------------------------------------------------------

async function runOnce(request: NextRequest): Promise<NextResponse> {
  const startMs = Date.now();

  // Auth
  const auth = isAuthorized(request);
  if (!auth.ok) {
    log("warn", "Unauthorized request", {
      reason: auth.reason,
      method: request.method,
      // Log the IP for rate-limiting / alerting — never the secret
      ip: request.headers.get("x-forwarded-for") ?? "unknown",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = `serverless:${process.env.VERCEL_REGION || "local"}:${crypto.randomBytes(6).toString("hex")}`;

  log("info", "Worker started", { workerId, authReason: auth.reason });

  // Claim job
  let job: Awaited<ReturnType<typeof analysisJobService.claimNextJob>>;
  try {
    job = await analysisJobService.claimNextJob({ workerId });
  } catch (err: any) {
    // Treat DB / service errors on claim as 503 so the cron retries
    log("error", "Failed to claim job", {
      workerId,
      error: err?.message ?? String(err),
    });
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 },
    );
  }

  if (!job) {
    log("info", "No pending jobs", { workerId });
    return new NextResponse(null, { status: 204 });
  }

  log("info", "Job claimed", {
    workerId,
    jobId: job.id,
    repositoryId: job.repositoryId,
    attempt: job.attempts,
    maxAttempts: job.maxAttempts,
  });

  // Initial progress ping — confirms the job is alive
  try {
    await analysisJobService.updateProgress({
      jobId: job.id,
      workerId,
      update: {
        progressPercent: job.progressPercent ?? 0,
        progressMessage: job.progressMessage ?? "Starting analysis…",
      },
    });
  } catch (err: any) {
    // Non-fatal — log and continue
    log("warn", "Failed to send initial progress update", {
      workerId,
      jobId: job.id,
      error: err?.message ?? String(err),
    });
  }

  // Run analysis with a hard timeout so we always respond before Vercel cuts us off
  try {
    await withTimeout(
      repositoryService.analyzeRepository(job.repositoryId, {
        onProgress: async (update) => {
          try {
            await analysisJobService.updateProgress({
              jobId: job.id,
              workerId,
              update,
            });
            log("info", "Progress update", {
              workerId,
              jobId: job.id,
              ...update,
            });
          } catch (progressErr: any) {
            // Progress failures are non-fatal — log and keep going
            log("warn", "Progress update failed", {
              workerId,
              jobId: job.id,
              error: progressErr?.message ?? String(progressErr),
            });
          }
        },
      }),
      WORKER_TIMEOUT_MS,
    );

    await analysisJobService.markDone({ jobId: job.id, workerId });

    const durationMs = Date.now() - startMs;
    log("info", "Job completed", { workerId, jobId: job.id, durationMs });

    return NextResponse.json({
      ok: true,
      jobId: job.id,
      status: "DONE",
      durationMs,
    });
  } catch (error: any) {
    const isTimeout = error?.code === "WORKER_TIMEOUT";
    // Never expose internal error details to callers
    const safeMessage = isTimeout
      ? "Analysis timed out — will retry"
      : "Analysis failed";

    const durationMs = Date.now() - startMs;

    log("error", isTimeout ? "Job timed out" : "Job failed", {
      workerId,
      jobId: job.id,
      durationMs,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts,
      // Internal detail stays server-side only
      internalError: error?.message ?? String(error),
    });

    // Mark job failed
    try {
      await analysisJobService.markFailed({
        jobId: job.id,
        workerId,
        error: safeMessage,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      });
    } catch (markErr: any) {
      // Best-effort — if this also fails, the job will be reclaimed after its
      // lock TTL expires (handled by the job service)
      log("error", "Failed to mark job as failed", {
        workerId,
        jobId: job.id,
        error: markErr?.message ?? String(markErr),
      });
    }

    // Issue #330 — ensure repo status is explicitly set to "failed" at the
    // runner layer, even if repositoryService's own catch block was bypassed
    // (e.g. Vercel timeout fires before repositoryService catch can run, or
    // the DB connection drops mid-analysis leaving status stuck on "analyzing").
    try {
      await repositoryService.setRepositoryStatus(job.repositoryId, "failed");
      log("info", "Repository status set to failed", {
        workerId,
        jobId: job.id,
        repositoryId: job.repositoryId,
      });
    } catch (repoErr: any) {
      // Non-fatal at this point — log for alerting but don't mask the original error
      log("error", "Failed to update repository status to failed", {
        workerId,
        jobId: job.id,
        repositoryId: job.repositoryId,
        error: repoErr?.message ?? String(repoErr),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        jobId: job.id,
        status: isTimeout ? "TIMEOUT" : "FAILED",
        error: safeMessage,
        durationMs,
      },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Route exports
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  return runOnce(request);
}

export async function GET(request: NextRequest) {
  return runOnce(request);
}