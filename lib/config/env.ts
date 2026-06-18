/**
 * Centralized utility for lazily resolving environment variables
 * to prevent build-time crashes caused by eager evaluation.
 */

const ALLOWED_DEV_SECRETS = new Set(["development", "test"]);

function isExplicitlyDev(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  return nodeEnv !== undefined && ALLOWED_DEV_SECRETS.has(nodeEnv);
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    return secret;
  }

  // Only use insecure fallback when NODE_ENV is explicitly set to a known dev value.
  // This prevents accidental insecure defaults when NODE_ENV is unset or misspelled in production.
  if (isExplicitlyDev()) {
    return "development-jwt-secret";
  }

  // In production, throw a safe error without exposing internal names or stack traces.
  throw new Error("Internal Server Error: Missing required security configuration.");
}

export function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (isExplicitlyDev()) {
    return "development-nextauth-secret";
  }

  throw new Error("Internal Server Error: Missing required security configuration.");
}
