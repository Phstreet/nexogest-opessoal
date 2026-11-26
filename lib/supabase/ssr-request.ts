import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  EXPIRY_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  getSupabaseConfig,
  setSessionCookies,
} from "@/lib/supabase/server";

export function createSupabaseRequestClient(request: NextRequest, response: NextResponse) {
  const { url, key } = getSupabaseConfig();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

/**
 * Transfere uma sessão existente dos cookies legados para o formato SSR.
 * Os cookies antigos permanecem sincronizados durante a transição.
 */
export async function bridgeLegacySession(
  request: NextRequest,
  response: NextResponse,
) {
  const supabase = createSupabaseRequestClient(request, response);
  const { data: current } = await supabase.auth.getSession();
  let session = current.session;

  const legacyAccess = request.cookies.get(ACCESS_COOKIE)?.value;
  const legacyRefresh = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!session && legacyAccess && legacyRefresh) {
    const { data, error } = await supabase.auth.setSession({
      access_token: legacyAccess,
      refresh_token: legacyRefresh,
    });
    if (error) throw error;
    session = data.session;
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    clearSessionCookies(response);
    request.cookies.delete(ACCESS_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
    request.cookies.delete(EXPIRY_COOKIE);
    return { authenticated: false, session: null };
  }

  const { data: refreshed } = await supabase.auth.getSession();
  session = refreshed.session ?? session;

  if (session) {
    setSessionCookies(response, session);
    request.cookies.set(ACCESS_COOKIE, session.access_token);
    request.cookies.set(REFRESH_COOKIE, session.refresh_token);
    request.cookies.set(
      EXPIRY_COOKIE,
      String(session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in),
    );
  }

  return {
    authenticated: Boolean(claimsData?.claims?.sub && session),
    session,
  };
}
