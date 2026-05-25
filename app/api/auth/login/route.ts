import { sanitizeError } from "@/lib/middleware";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { generateToken } from "@/lib/auth";
import { apiError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase();

    // Validation
    if (!email || !password) {
      return apiError(400, "Email and password are required");
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return apiError(401, "Invalid email or password");
    }

    // Security: never allow password login for Google-only accounts.
    // A "Google-only" account is a user without a local password, but with a linked Google OAuth account.
    if (!user.passwordHash) {
      const hasGoogleAccount =
        (await prisma.account.count({
          where: { userId: user.id, provider: "google" },
        })) > 0;

      if (hasGoogleAccount) {
        return apiError(
  401,
  "Email already exists. Please sign in with Google."
);
      }
    }

    // Verify password
    const passwordHash = user.passwordHash || (user as any).password;
    if (!passwordHash) {
  return apiError(401, "Invalid email or password");
}
    const isValidPassword = await bcrypt.compare(password, passwordHash);

    if (!isValidPassword) {
  return apiError(401, "Invalid email or password");
}

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: (user as any).image,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
   return apiError(500, "Internal server error");
  }
}
