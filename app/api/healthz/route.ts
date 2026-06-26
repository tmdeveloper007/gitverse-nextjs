import { NextResponse } from "next/server";

/**
 * GET /api/healthz
 *
 * Lightweight health check endpoint for load balancers and uptime monitors.
 * Returns 200 with { status: 'ok' } without requiring authentication.
 * Response is never cached to ensure fresh health status.
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
