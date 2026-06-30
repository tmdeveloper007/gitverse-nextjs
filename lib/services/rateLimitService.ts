import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastCleanupAt = 0;

export type AttemptType =
  | "LOGIN"
  | "SIGNUP"
  | "CHANGE_PASSWORD"
  | "DELETE_ACCOUNT"
  | "REPOSITORY_ANALYSIS"
  | "ANALYSIS_RUNNER";

const RETENTION_DAYS = 7;

function getRetentionThreshold(): Date {
  return new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Returns true if the IP address belongs to a trusted proxy range
 * (loopback, private, or link-local networks). Only these addresses are
 * trusted when they appear in x-forwarded-for.
 */
function isTrustedProxyIp(ip: string): boolean {
  // Loopback: 127.0.0.0/8
  if (/^127\./.test(ip)) return true;
  // IPv6 loopback
  if (ip === "::1") return true;
  // IPv6 link-local
  if (ip.toLowerCase().startsWith("fe80:")) return true;

  // IPv4 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;

  return false;
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for is a comma-separated chain: client, proxy1, proxy2, ...
    // Only trust the leftmost IP if it comes from a known proxy.
    const ips = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    const firstIp = ips[0];

    if (firstIp && firstIp !== "unknown" && isTrustedProxyIp(firstIp)) {
      // Trust the full chain — return the rightmost non-trusted IP (actual client).
      // If the entire chain consists of trusted proxy IPs, fall back to request.ip.
      for (let i = ips.length - 1; i >= 0; i--) {
        if (!isTrustedProxyIp(ips[i])) {
          return ips[i];
        }
      }
      // All IPs in chain are trusted proxies; fall through to request.ip.
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp !== "unknown" && !isTrustedProxyIp(realIp)) {
    // Only trust x-real-ip when it looks like a real client IP, not a spoofed one.
    return realIp;
  }

  return request.ip ?? "unknown";
}

async function maybeCleanupStaleAttempts() {
  const now = Date.now();

  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupAt = now;

  try {
    await cleanupStaleAttempts();
  } catch (error) {
    console.error("Background stale attempt cleanup failed:", error);
  }
}

export async function isRateLimited(
  key: string,
  type: AttemptType,
  maxAttempts: number,
  windowMs: number
): Promise<boolean> {
  try {
    void maybeCleanupStaleAttempts();
    const since = new Date(Date.now() - windowMs);

    const count = await prisma.loginAttempt.count({
      where: {
        key,
        type,
        createdAt: { gte: since },
        success: false,
      },
    });

    return count >= maxAttempts;
  } catch (error) {
    console.error(`Rate limit check failed for key=${key} type=${type}:`, error);
    throw error;
  }
}

export async function isAnalysisRunnerRateLimited(
  workerId: string,
): Promise<boolean> {
  const maxJobsPerMinute = 10;
  const windowMs = 60 * 1000;

  try {
    const since = new Date(Date.now() - windowMs);
    const count = await prisma.loginAttempt.count({
      where: {
        key: `runner:${workerId}`,
        type: "ANALYSIS_RUNNER",
        createdAt: { gte: since },
      },
    });

    return count >= maxJobsPerMinute;
  } catch (error) {
    console.error(`Analysis runner rate limit check failed for worker=${workerId}:`, error);
    throw error;
  }
}

export async function countAttempts(
  key: string,
  type: AttemptType,
  windowMs: number
): Promise<number> {
  try {
    void maybeCleanupStaleAttempts();
    const since = new Date(Date.now() - windowMs);

    return await prisma.loginAttempt.count({
      where: {
        key,
        type,
        createdAt: { gte: since },
      },
    });
  } catch (error) {
    console.error(`Rate limit count failed for key=${key} type=${type}:`, error);
    throw error;
  }
}

export async function recordAttempt(params: {
  key: string;
  type: AttemptType;
  success: boolean;
  email?: string;
  userId?: number;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        key: params.key,
        type: params.type,
        success: params.success,
        email: params.email ?? null,
        userId: params.userId ?? null,
      },
    });
  } catch (error) {
    console.error(`Failed to record rate limit attempt key=${params.key} type=${params.type}:`, error);
    throw error;
  }
}

export async function recordAnalysisRunnerAttempt(
  workerId: string,
  jobId: string,
  success: boolean,
): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        key: `runner:${workerId}`,
        type: "ANALYSIS_RUNNER",
        success,
        email: null,
        userId: null,
      },
    });
  } catch (error) {
    console.error(`Failed to record analysis runner attempt worker=${workerId} job=${jobId}:`, error);
    throw error;
  }
}

export async function clearFailedAttempts(
  key: string,
  type: AttemptType
): Promise<void> {
  try {
    await prisma.loginAttempt.deleteMany({
      where: {
        key,
        type,
        success: false,
      },
    });
  } catch (error) {
    console.error(`Failed to clear rate limit attempts key=${key} type=${type}:`, error);
  }
}

export async function cleanupStaleAttempts(): Promise<number> {
  try {
    const result = await prisma.loginAttempt.deleteMany({
      where: {
        createdAt: { lt: getRetentionThreshold() },
      },
    });
    return result.count;
  } catch (error) {
    console.error("Failed to clean up stale attempts:", error);
    return 0;
  }
}
