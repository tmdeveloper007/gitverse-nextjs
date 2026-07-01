import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { sanitizeErrorMessage } from "@/lib/utils/rateLimit";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

const HEATMAP_RATE_LIMIT = 30;
const HEATMAP_WINDOW_MS = 60_000;
const heatmapReqCounts = new Map<string, { count: number; resetAt: number }>();

function checkHeatmapRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = heatmapReqCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    heatmapReqCounts.set(ip, { count: 1, resetAt: now + HEATMAP_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= HEATMAP_RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

export async function GET(req: NextRequest) {
  // Auth guard
  let user: { userId: number } | null = null;
  try {
    user = await requireAuth(req);
  } catch (authError: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage("Unauthorized") },
      { status: authError?.status || 401 }
    );
  }

  // Rate limit per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const limitResult = checkHeatmapRateLimit(ip);
  if (!limitResult.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Retry after ${limitResult.retryAfter} seconds.` },
      { status: 429,
        headers: { "Retry-After": String(limitResult.retryAfter ?? 60) }
      }
    );
  }

  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
  }

  const query = `
    query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                color
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { login: username } }),
      next: { revalidate: 3600 }, // cache 1hr
    });

    if (!response.ok) {
      return NextResponse.json({ error: "GitHub API error" }, { status: response.status });
    }

    const data = await response.json();

    if (data.errors) {
      return NextResponse.json({ error: data.errors[0].message }, { status: 400 });
    }

    const calendar =
      data?.data?.user?.contributionsCollection?.contributionCalendar;

    if (!calendar) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(calendar);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch heatmap" }, { status: 500 });
  }
}