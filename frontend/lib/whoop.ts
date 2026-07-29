/**
 * Whoop Developer API v2 client — OAuth 2.0 authorization-code flow plus
 * typed fetchers for the metrics used on the dashboard.
 *
 * Verify these endpoint paths/scopes against the current Whoop Developer
 * Platform docs (developer.whoop.com) before going live — API surfaces can
 * change between when this was written and when you deploy.
 */
import { config } from "./config";

const WHOOP_AUTH_URL = "https://api.whoop.com/oauth/oauth/authorize";
const WHOOP_TOKEN_URL = "https://api.whoop.com/oauth/oauth/token";
const WHOOP_API_BASE = "https://api.whoop.com/developer/v2";

export interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.whoop.clientId,
    redirect_uri: config.whoop.redirectUri,
    response_type: "code",
    scope: config.whoop.scopes,
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<WhoopTokens> {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.whoop.clientId,
      client_secret: config.whoop.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.whoop.redirectUri,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Whoop token exchange failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

export async function refreshTokens(refreshToken: string): Promise<WhoopTokens> {
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.whoop.clientId,
      client_secret: config.whoop.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Whoop token refresh failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function whoopFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${WHOOP_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Whoop API request to ${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

export function getRecovery(accessToken: string, params?: { limit?: number }) {
  const query = params?.limit ? `?limit=${params.limit}` : "";
  return whoopFetch<{ records: unknown[] }>(`/recovery${query}`, accessToken);
}

export function getSleep(accessToken: string, params?: { limit?: number }) {
  const query = params?.limit ? `?limit=${params.limit}` : "";
  return whoopFetch<{ records: unknown[] }>(`/activity/sleep${query}`, accessToken);
}

export function getWorkouts(accessToken: string, params?: { limit?: number }) {
  const query = params?.limit ? `?limit=${params.limit}` : "";
  return whoopFetch<{ records: unknown[] }>(`/activity/workout${query}`, accessToken);
}

export function getProfile(accessToken: string) {
  return whoopFetch<{ user_id: number; email: string; first_name: string; last_name: string }>(
    "/user/profile/basic",
    accessToken,
  );
}

export function getBodyMeasurement(accessToken: string) {
  return whoopFetch<{ height_meter: number; weight_kilogram: number; max_heart_rate: number }>(
    "/user/measurement/body",
    accessToken,
  );
}
