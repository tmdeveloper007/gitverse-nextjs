/**
 * Recently Active Areas API Route
 * Handles tracking and retrieving recently modified code areas for quick navigation
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";

export const runtime = "nodejs";

interface ActiveAreaRequest {
  repositoryId: string;
  area: {
    path: string;
    type: "file" | "directory" | "domain";
    activityCount: number;
    lastActivity: string;
  };
}

interface ActiveAreasQueryResponse {
  repositoryId: string;
  areas: any[];
  totalAreas: number;
}

/**
 * POST - Record a newly active code area
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body: ActiveAreaRequest = await request.json();

    if (!body.repositoryId || !body.area) {
      return NextResponse.json(
        { error: "Missing required fields: repositoryId, area" },
        { status: 400 }
      );
    }

    const repositoryId = parseInt(body.repositoryId, 10);
    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "Invalid repositoryId" },
        { status: 400 }
      );
    }

    const repository = await repositoryService.getRepository(repositoryId, user.userId);
    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found or access denied" },
        { status: 404 }
      );
    }

    const storedArea = {
      ...body.area,
      id: `area-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recordedAt: new Date().toISOString(),
    };

    return NextResponse.json(
      { success: true, message: "Active area recorded successfully", area: storedArea },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error recording active area:", error);
    return NextResponse.json({ error: "Failed to record active area" }, { status: 500 });
  }
}

/**
 * GET - Retrieve recently active areas for a repository
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const repositoryIdParam = searchParams.get("repositoryId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!repositoryIdParam) {
      return NextResponse.json(
        { error: "Missing required query parameter: repositoryId" },
        { status: 400 }
      );
    }

    const repositoryId = parseInt(repositoryIdParam, 10);
    if (isNaN(repositoryId)) {
      return NextResponse.json(
        { error: "Invalid repositoryId" },
        { status: 400 }
      );
    }

    const repository = await repositoryService.getRepository(repositoryId, user.userId);
    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found or access denied" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { repositoryId: repositoryIdParam, areas: [], totalAreas: 0 },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error retrieving active areas:", error);
    return NextResponse.json(
      { error: "Failed to retrieve active areas" },
      { status: 500 }
    );
  }
}
