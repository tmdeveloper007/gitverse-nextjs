import { NextRequest, NextResponse } from "next/server";
import { requireAuth, sanitizeError } from "@/lib/middleware";
import { GitHubService, GitHubRateLimitError } from "@/lib/services/githubService";
import { repositoryService } from "@/lib/services/repositoryService";
import { analysisJobService } from "@/lib/services/analysisJobService";
import { triggerAnalysisWorkerWorkflow } from "@/lib/services/analysisWorkerTriggerService";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/middleware/rateLimit";
import { getDecryptedGitHubToken } from "@/lib/utils/githubToken";
import crypto from "crypto";
function kickLocalRunner(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return;
  const origin = new URL(request.url).origin;
  const secret = process.env.ANALYSIS_RUNNER_SECRET;
  if (!secret) return;
  void fetch(`${origin}/api/internal/run-analysis`, {
    method: "POST",
    headers: { "x-analysis-runner-secret": secret },
  }).catch(() => {
    // Best-effort only.
  });
}

function kickProductionWorker() {
  if (process.env.NODE_ENV !== "production") return;

  void triggerAnalysisWorkerWorkflow().catch((error) => {
    logger.error(
      { err: sanitizeError(error) },
      "Failed to dispatch analysis worker workflow",
    );
  });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const rl = await checkRateLimit(String(user.userId), RATE_LIMITS.GITHUB_IMPORT);
    if (!rl.allowed) return rateLimitResponse(rl);
    const body = await request.json();
    const { url, token } = body;

    if (!url) {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    // SECURITY: Verify token ownership. Accept token from request body only if it
    // matches the token already stored for this user in the database. Reject arbitrary
    // tokens supplied by the client to prevent auth bypass attacks.
    const storedToken = await getDecryptedGitHubToken(user.userId);
    let verifiedToken: string | null = null;

    if (token && storedToken) {
      // Compare tokens in constant time to prevent timing attacks
      const tokenBuf = Buffer.from(token);
      const storedBuf = Buffer.from(storedToken);
      if (tokenBuf.length === storedBuf.length && crypto.timingSafeEqual(tokenBuf, storedBuf)) {
        verifiedToken = token;
      }
    }

    if (!verifiedToken && !storedToken) {
      return NextResponse.json(
        { error: "GitHub account not connected. Please connect your GitHub account first." },
        { status: 403 }
      );
    }

    if (!verifiedToken) {
      return NextResponse.json(
        { error: "GitHub token does not match your connected account." },
        { status: 403 }
      );
    }

    const parsed = GitHubService.parseGitHubUrl(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub URL" },
        { status: 400 }
      );
    }

    const github = new GitHubService(verifiedToken);
    const repoData = await github.getRepository(parsed.owner, parsed.repo);

    const repository = await repositoryService.createRepository({
      name: repoData.name,
      url: repoData.clone_url,
      description: repoData.description || undefined,
      userId: user.userId,
    });

    const job = await analysisJobService.createRepositoryAnalysisJob({
      repositoryId: repository.id,
      userId: user.userId,
      scope: undefined,
    });

    kickLocalRunner(request);
    kickProductionWorker();

    return NextResponse.json({ repository, jobId: job.id, jobStatus: job.status, source: "github" }, { status: 201 });
  } catch (error: any) {
    console.error("GitHub import error:", sanitizeError(error));

    if (error instanceof GitHubRateLimitError) {
      return NextResponse.json(
        { error: error.message, retryAfter: error.retryAfterSeconds },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to import from GitHub" },
      { status: 500 }
    );
  }
}
