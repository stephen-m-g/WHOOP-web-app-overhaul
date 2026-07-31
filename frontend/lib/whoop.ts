/**
 * Whoop Developer API v2 client — OAuth 2.0 authorization-code flow plus
 * typed fetchers for the metrics used on the dashboard.
 *
 * Verify these endpoint paths/scopes/field names against the current Whoop
 * Developer Platform docs (developer.whoop.com) before going live — API
 * surfaces can change between when this was written and when you deploy.
 */
import { config } from "./config";

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API_BASE = "https://api.prod.whoop.com/developer/v2";

export interface WhoopTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export type JumpType = "vertical" | "broad";

export interface RecoveryRecord {
  cycle_id: number;
  sleep_id: number;
  created_at: string;
  updated_at: string;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE";
  score?: {
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
}

export interface SleepRecord {
  id: string;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  nap: boolean;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE";
  score?: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      disturbance_count: number;
    };
    sleep_needed: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
    };
    respiratory_rate?: number;
    sleep_performance_percentage?: number;
    sleep_consistency_percentage?: number;
    sleep_efficiency_percentage?: number;
  };
}

export interface WorkoutRecord {
  id: string;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  sport_id: number;
  sport_name?: string;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE";
  score?: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    distance_meter?: number;
  };
}

export interface CycleRecord {
  id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string | null;
  score_state: "SCORED" | "PENDING_SCORE" | "UNSCORABLE";
  score?: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
}

export interface ProfileRecord {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface BodyMeasurementRecord {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
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

interface DateRangeParams {
  limit?: number;
  start?: string;
  end?: string;
}

function buildQuery(params?: DateRangeParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getRecovery(accessToken: string, params?: DateRangeParams) {
  return whoopFetch<{ records: RecoveryRecord[] }>(`/recovery${buildQuery(params)}`, accessToken);
}

export function getSleep(accessToken: string, params?: DateRangeParams) {
  return whoopFetch<{ records: SleepRecord[] }>(`/activity/sleep${buildQuery(params)}`, accessToken);
}

export function getWorkouts(accessToken: string, params?: DateRangeParams) {
  return whoopFetch<{ records: WorkoutRecord[] }>(`/activity/workout${buildQuery(params)}`, accessToken);
}

export function getCycles(accessToken: string, params?: DateRangeParams) {
  return whoopFetch<{ records: CycleRecord[] }>(`/cycle${buildQuery(params)}`, accessToken);
}

export function getProfile(accessToken: string) {
  return whoopFetch<ProfileRecord>("/user/profile/basic", accessToken);
}

export function getBodyMeasurement(accessToken: string) {
  return whoopFetch<BodyMeasurementRecord>("/user/measurement/body", accessToken);
}
