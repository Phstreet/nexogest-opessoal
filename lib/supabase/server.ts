import type { NextRequest, NextResponse } from "next/server";

export const ACCESS_COOKIE = "nexo_access_token";
export const REFRESH_COOKIE = "nexo_refresh_token";
export const EXPIRY_COOKIE = "nexo_token_expires_at";

export function getSupabaseConfig() {
  const dev = process.env.NODE_ENV !== "production";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || (dev ? "https://mmwkpwspyjvxsennvhic.supabase.co" : "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || (dev ? "sb_publishable_-TkcxAdmwC_Mt-bLwUPQvw_x9JwKDyk" : "");
  if (!url || !key) throw new Error("Supabase não configurado neste ambiente. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  return { url: url.replace(/\/$/, ""), key };
}

export function setSessionCookies(
  response: NextResponse,
  session: { access_token: string; refresh_token: string; expires_in?: number }
) {
  const maxAge = Math.max(60, Number(session.expires_in || 3600));
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
  response.cookies.set(ACCESS_COOKIE, session.access_token, options);
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, { ...options, maxAge: 60 * 60 * 24 * 30 });
  response.cookies.set(EXPIRY_COOKIE, String(Math.floor(Date.now() / 1000) + maxAge), options);
}

export function clearSessionCookies(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, EXPIRY_COOKIE]) {
    response.cookies.set(name, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  }
}

export async function getValidAccessToken(request: NextRequest, response: NextResponse): Promise<string | null> {
  const { url, key } = getSupabaseConfig();
  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const expiresAt = Number(request.cookies.get(EXPIRY_COOKIE)?.value || 0);
  if (!access || !refresh) return null;
  if (expiresAt > Math.floor(Date.now() / 1000) + 90) return access;

  const refreshed = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
    cache: "no-store",
  });
  if (!refreshed.ok) {
    clearSessionCookies(response);
    return null;
  }
  const data = await refreshed.json();
  if (!data.access_token || !data.refresh_token) {
    clearSessionCookies(response);
    return null;
  }
  setSessionCookies(response, data);
  access = data.access_token as string;
  return access;
}

export async function fetchSupabaseUser(accessToken: string) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json();
}

export function hasValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
}
