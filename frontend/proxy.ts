/**
 * Refreshes the Whoop session cookie (if it's about to expire) before
 * /dashboard renders. Cookie mutation isn't legal during Server Component
 * rendering, so it has to happen here instead — see lib/auth.ts.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  EXPIRES_AT_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE_OPTIONS,
} from "./lib/auth";
import { refreshTokens } from "./lib/whoop";

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const expiresAt = Number(request.cookies.get(EXPIRES_AT_COOKIE)?.value ?? 0);

  if (!refreshToken) {
    return NextResponse.next();
  }

  const isExpiringSoon = Date.now() > expiresAt - 60_000;
  if (!isExpiringSoon && accessToken) {
    return NextResponse.next();
  }

  try {
    const tokens = await refreshTokens(refreshToken);
    const response = NextResponse.next();
    const newExpiresAt = Date.now() + tokens.expires_in * 1000;

    response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.access_token, SESSION_COOKIE_OPTIONS);
    response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, SESSION_COOKIE_OPTIONS);
    response.cookies.set(EXPIRES_AT_COOKIE, String(newExpiresAt), SESSION_COOKIE_OPTIONS);
    return response;
  } catch {
    // Refresh token is invalid/expired — clear the session and let the
    // page render its "connect to Whoop" state.
    const response = NextResponse.next();
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    response.cookies.delete(EXPIRES_AT_COOKIE);
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
