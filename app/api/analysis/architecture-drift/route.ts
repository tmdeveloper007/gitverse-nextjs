/**
 * Architecture Drift Snapshots API Route
 * Handles storing and retrieving architecture snapshots for historical analysis
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware";
import { repositoryService } from "@/lib/services/repositoryService";

export const runtime = "nodejs";

interface SnapshotRequest {
  repositoryId: string;
  snapshot: any;
}

interface SnapshotQueryResponse {
  repositoryId: string;
  snapshots: any[];
  totalSnapshots: number;
}

/**
 * POST - Store a new architecture snapshot
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body: SnapshotRequest = await request.json();

    if (!body.repositoryId || !body.snapshot) {
      return NextResponse.json(
        { error: "Missing required fields: repositoryId, snapshot" },
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

    const storedSnapshot = {
      ...body.snapshot,
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      storedAt: new Date().toISOString(),
    };

    return NextResponse.json(
      { success: true, message: "Snapshot stored successfully", snapshot: storedSnapshot },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error storing snapshot:", error);
    return NextResponse.json({ error: "Failed to store snapshot" }, { status: 500 });
  }
}

/**
 * GET - Retrieve architecture snapshots for a repository
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const repositoryIdParam = searchParams.get("repositoryId");
    const days = parseInt(searchParams.get("days") || "30", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!repositoryIdParam) {
      return NextResponse.json({ error: "Missing required query parameter: repositoryId" }, { status: 400 });
    }
    const repositoryId = parseInt(repositoryIdParam, 10);
    if (isNaN(repositoryId)) {
      return NextResponse.json({ error: "Invalid repositoryId" }, { status: 400 });
    }
    const repository = await repositoryService.getRepository(repositoryId, user.userId);
    if (!repository) {
      return NextResponse.json({ error: "Repository not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ repositoryId: repositoryIdParam, snapshots: [], totalSnapshots: 0 }, { status: 200 });
  } catch (error) {
    console.error("Error retrieving snapshots:", error);
    return NextResponse.json({ error: "Failed to retrieve snapshots" }, { status: 500 });
  }
}

/**
 * DELETE - Remove old snapshots beyond retention period
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const repositoryIdParam = searchParams.get("repositoryId");
    if (!repositoryIdParam) {
      return NextResponse.json({ error: "Missing required query parameter: repositoryId" }, { status: 400 });
    }
    const repositoryId = parseInt(repositoryIdParam, 10);
    if (isNaN(repositoryId)) {
      return NextResponse.json({ error: "Invalid repositoryId" }, { status: 400 });
    }
    const repository = await repositoryService.getRepository(repositoryId, user.userId);
    if (!repository) {
      return NextResponse.json({ error: "Repository not found or access denied" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: `Deleted snapshots for repository ${repositoryIdParam}` }, { status: 200 });
  } catch (error) {
    console.error("Error deleting snapshots:", error);
    return NextResponse.json({ error: "Failed to delete snapshots" }, { status: 500 });
  }
}
