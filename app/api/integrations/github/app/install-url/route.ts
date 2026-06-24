import { NextRequest, NextResponse } from "next/server";
import { isHttpError, requireAuth , sanitizeError } from "@/lib/middleware";
import { createSignedState } from "@/lib/utils/signedState";

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const slug = getRequiredEnv("GITHUB_APP_SLUG");

    // Generate a unique per-tab state so that multiple tabs can each run an independent
    // OAuth flow without one tab's callback overwriting another's state.  The tabId is
    // embedded in the signed token so the callback can verify it independently of cookies.
    const tabId = Math.random().toString(36).slice(2, 10);
    const state = createSignedState({
      userId: user.userId,
      ts: Date.now(),
      tabId,
    });

    // Return both the URL and the raw state so the UI can store the state in
    // sessionStorage before redirecting, enabling per-tab validation in the callback.
    const installUrl = `https://github.com/apps/${encodeURIComponent(
      slug,
    )}/installations/new?state=${encodeURIComponent(state)}`;

    return NextResponse.json({ url: installUrl, state }, { status: 200 });
  } catch (error: any) {
    console.error("GitHub App install-url error:", sanitizeError(error));
    if (isHttpError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to create install URL" },
      { status: 500 },
    );
  }
}
