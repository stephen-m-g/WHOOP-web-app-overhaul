/**
 * Cookie-backed session storage for Whoop OAuth tokens. Tokens live in
 * httpOnly cookies so they're never exposed to client-side JS.
 *
 * Cookie *writes* are only legal inside Route Handlers, Server Actions, or
 * proxy.ts — never during Server Component rendering. Token refresh
 * therefore happens in proxy.ts (see project root), which runs before
 * protected pages render. Pages should use the read-only getSession() below.
 */
import "server-only";
import { cookies } from "next/headers";
import type { WhoopTokens } from "./whoop";

export const ACCESS_TOKEN_COOKIE = "whoop_access_token";
export const REFRESH_TOKEN_COOKIE = "whoop_refresh_token";
export const EXPIRES_AT_COOKIE = "whoop_expires_at";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  isExpiringSoon: boolean;
}

/** Read-only — safe to call from Server Components. */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  const expiresAt = Number(cookieStore.get(EXPIRES_AT_COOKIE)?.value ?? 0);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    // Refresh a little early to avoid races with in-flight requests.
    isExpiringSoon: Date.now() > expiresAt - 60_000,
  };
}

/** Mutates cookies — only call from a Route Handler or proxy.ts. */
export async function setSession(tokens: WhoopTokens): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.access_token, SESSION_COOKIE_OPTIONS);
  cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, SESSION_COOKIE_OPTIONS);
  cookieStore.set(EXPIRES_AT_COOKIE, String(expiresAt), SESSION_COOKIE_OPTIONS);
}

/** Mutates cookies — only call from a Route Handler or proxy.ts. */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  cookieStore.delete(EXPIRES_AT_COOKIE);
}
