import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * Error response payload for GitHub App not installed.
 */
export interface GitHubAppNotInstalledResponse {
  error: string;
  code: "GITHUB_APP_NOT_INSTALLED";
  setupUrl: string;
}

/**
 * Checks if a user has a valid GitHub App installation.
 * 
 * A valid installation means:
 * - User has a gitHubAccount row (OAuth token stored), OR
 * - User has at least one gitHubRepo with a non-null installationId
 *
 * @param userId - The authenticated user's ID
 * @returns true if the user has a valid installation, false otherwise
 */
export async function hasGitHubAppInstallation(userId: number): Promise<boolean> {
  // Check for gitHubAccount (OAuth-based authentication)
  const gitHubAccount = await prisma.gitHubAccount.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (gitHubAccount) {
    return true;
  }

  // Check for any repo with an installationId (GitHub App-based)
  const repoWithInstallation = await prisma.gitHubRepo.findFirst({
    where: {
      userId,
      installationId: { not: null },
    },
    select: { id: true },
  });

  return repoWithInstallation !== null;
}

/**
 * Middleware-style helper that checks GitHub App installation and returns
 * a structured error response if not installed.
 * 
 * Use this at the start of API route handlers that require GitHub App access.
 *
 * @param userId - The authenticated user's ID
 * @returns NextResponse with error details if not installed, null otherwise
 */
export async function requireGitHubAppInstallation(
  userId: number
): Promise<NextResponse<GitHubAppNotInstalledResponse> | null> {
  const isInstalled = await hasGitHubAppInstallation(userId);

  if (!isInstalled) {
    return NextResponse.json(
      {
        error:
          "GitHub App is not installed or not configured. Please install the GitHub App to access this feature.",
        code: "GITHUB_APP_NOT_INSTALLED",
        setupUrl: "/api/integrations/github/app/install-url",
      },
      { status: 400 }
    );
  }

  return null;
}