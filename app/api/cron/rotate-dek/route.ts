import { NextRequest, NextResponse } from "next/server";
import { rotateDek } from "@/lib/utils/envelopeEncryption";
import {
  isCronAuthorized,
  validateAuthorizationHeader,
} from "@/lib/utils/internalAuth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  // Use timing-safe comparison to prevent timing oracle attacks.
  // isCronAuthorized allows a plain Bearer token for convenience, but
  // for high-privilege operations like DEK rotation, enforce hashed token.
  if (
    !validateAuthorizationHeader(authHeader, process.env.CRON_SECRET) &&
    !validateAuthorizationHeader(authHeader, process.env.ANALYSIS_RUNNER_SECRET)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await rotateDek();
    console.log("[RotateDEK] Key rotated successfully");

    return NextResponse.json({
      success: true,
      message: "DEK rotated successfully. Update WRAPPED_DEK in all environments.",
      wrappedDekPrefix: result.newWrapped.substring(0, 16) + "...",
    });
  } catch (e: any) {
    console.error("[RotateDEK] Rotation failed:", e.message);
    return NextResponse.json(
      { error: `DEK rotation failed: ${e.message}` },
      { status: 500 },
    );
  }
}
