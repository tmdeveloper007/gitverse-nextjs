import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/middleware";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header is required" },
        { status: 400 }
      );
    }

    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      { error: "Failed to process logout request" },
      { status: 500 }
    );
  }
}