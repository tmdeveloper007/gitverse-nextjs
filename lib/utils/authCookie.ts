import { NextResponse } from "next/server";

const COOKIE_NAMES = ["next-auth.session-token", "next-auth.csrf-token", "next-auth.callback-url"];

// Name of the httpOnly session cookie for the gitverse JWT token.
export const GITVERSE_SESSION_COOKIE = "gitverse_session";

// Cookie options for the gitverse session cookie.
export function getGitverseSessionCookieOptions(maxAge: number): string {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${maxAge}`;
}

export function getGitverseClearCookieOptions(): string {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`;
}


const COOKIE_OPTIONS = "Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax";

export function getClearCookieHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of COOKIE_NAMES) {
    headers["Set-Cookie"] = headers["Set-Cookie"]
      ? `${headers["Set-Cookie"]}, ${name}=; ${COOKIE_OPTIONS}`
      : `${name}=; ${COOKIE_OPTIONS}`;
  }
  return headers;
}

export function getGitverseClearCookieHeader(): string {
  return `${GITVERSE_SESSION_COOKIE}=; ${getGitverseClearCookieOptions()}`;
}

export function appendClearCookieHeaders(response: NextResponse): void {
  for (const name of COOKIE_NAMES) {
    response.headers.append("Set-Cookie", `${name}=; ${COOKIE_OPTIONS}`);
  }
}
