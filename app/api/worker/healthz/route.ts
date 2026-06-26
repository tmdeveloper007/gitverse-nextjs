import { NextRequest, NextResponse } from "next/server";
import { isInternalWorkerAuthorized } from "@/lib/utils/internalAuth";

export async function GET(request: NextRequest) {
  const authorized = isInternalWorkerAuthorized(
    request.headers.get("authorization")
  );
  const body: Record<string, unknown> = { status: "ok" };

  if (authorized) {
    // Only expose internal details to authorized internal callers
    body.uptime = process.uptime();
    body.version = process.env.npm_package_version || "unknown";
  }

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}