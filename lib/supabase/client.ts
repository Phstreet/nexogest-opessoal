/**
 * Cliente leve do Supabase via HTTP.
 * Usa somente a chave publishable (pública) e respeita RLS.
 * Nenhuma service_role/secret key é utilizada no navegador.
 */
export type NexoSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
};

export type RemoteCollection = {
  data_key: string;
  payload: unknown;
  revision: number;
  updated_at: string;
};

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mmwkpwspyjvxsennvhic.supabase.co").replace(/\/$/, "");
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_-TkcxAdmwC_Mt-bLwUPQvw_x9JwKDyk";
const SESSION_KEY = "nexo_auth_session";

function headers(token?: string) {
  assertConfigured();
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token || SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.msg || body.message || body.error_description || body.error || "Não foi possível concluir a solicitação.";
    throw new Error(String(message));
  }
  return body as T;
}

function normalizeSession(value: Partial<NexoSession> & { expires_in?: number }): NexoSession {
  const expiresIn = Number(value.expires_in || 3600);
  return {
    access_token: String(value.access_token || ""),
    refresh_token: String(value.refresh_token || ""),
    token_type: String(value.token_type || "bearer"),
    expires_in: expiresIn,
    expires_at: Number(value.expires_at || Math.floor(Date.now() / 1000) + expiresIn),
    user: value.user as NexoSession["user"],
  };
}

export function getStoredSession(): NexoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NexoSession;
    if (!parsed.access_token || !parsed.refresh_token || !parsed.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeSession(session: NexoSession | null) {
  if (typeof window === "undefined") return;
  if (!session) window.localStorage.removeItem(SESSION_KEY);
  else window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("nexo:auth-changed"));
}

export async function signInWithPassword(email: string, password: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: headers(), body: JSON.stringify({ email, password }),
  });
  const data = await readResponse<NexoSession>(response);
  const session = normalizeSession(data);
  storeSession(session);
  return session;
}

export async function signUpWithPassword(email: string, password: string, displayName: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup?redirect_to=${encodeURIComponent(window.location.origin)}`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ email, password, data: { display_name: displayName } }),
  });
  const data = await readResponse<NexoSession | { user?: NexoSession["user"]; session?: NexoSession }>(response);
  const rawSession = "session" in data && data.session ? data.session : data as NexoSession;
  if (rawSession?.access_token && rawSession?.refresh_token && rawSession?.user?.id) {
    const session = normalizeSession(rawSession);
    storeSession(session);
    return { session, confirmationRequired: false };
  }
  return { session: null, confirmationRequired: true };
}

export async function refreshSession(session: NexoSession) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers: headers(),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const next = normalizeSession(await readResponse<NexoSession>(response));
  storeSession(next);
  return next;
}

export async function signOutSession(session: NexoSession) {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST", headers: headers(session.access_token),
    });
  } finally {
    storeSession(null);
  }
}

export async function requestPasswordReset(email: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(window.location.origin + "/redefinir-senha")}`, {
    method: "POST", headers: headers(), body: JSON.stringify({ email }),
  });
  await readResponse<unknown>(response);
}

export async function updatePassword(session: NexoSession, password: string) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT", headers: headers(session.access_token), body: JSON.stringify({ password }),
  });
  await readResponse<unknown>(response);
}

export async function fetchRemoteCollections(session: NexoSession): Promise<RemoteCollection[]> {
  assertConfigured();
  const query = new URLSearchParams({
    select: "data_key,payload,revision,updated_at",
    user_id: `eq.${session.user.id}`,
    order: "data_key.asc",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/nexo_user_data?${query.toString()}`, {
    method: "GET", headers: headers(session.access_token), cache: "no-store",
  });
  return readResponse<RemoteCollection[]>(response);
}

export async function saveRemoteCollection(
  session: NexoSession, dataKey: string, payload: unknown, expectedRevision: number
): Promise<{ saved: boolean; current_revision: number | null; current_updated_at: string | null }> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/save_nexo_user_data`, {
    method: "POST", headers: headers(session.access_token),
    body: JSON.stringify({ p_data_key: dataKey, p_payload: payload, p_expected_revision: expectedRevision }),
  });
  const result = await readResponse<Array<{ saved: boolean; current_revision: number | null; current_updated_at: string | null }> | { saved: boolean; current_revision: number | null; current_updated_at: string | null }>(response);
  return Array.isArray(result) ? result[0] : result;
}

export const NEXO_SYNC_KEYS = [
  "nexo_transactions", "nexo_accounts", "nexo_reserves", "nexo_reserve_movements",
  "nexo_tasks", "nexo_habits", "nexo_preferences", "nexo_profile",
] as const;

export type NexoSyncKey = (typeof NEXO_SYNC_KEYS)[number];
export { SESSION_KEY };
