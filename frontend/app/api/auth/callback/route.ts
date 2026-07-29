import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/whoop";

const STATE_COOKIE = "whoop_oauth_state";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (error) {
    return NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/dashboard?error=invalid_state", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await setSession(tokens);
  } catch (err) {
    console.error("Whoop token exchange failed", err);
    return NextResponse.redirect(new URL("/dashboard?error=token_exchange_failed", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
