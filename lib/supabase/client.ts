/**
 * Cliente do NEXO para suas rotas seguras de autenticação e sincronização.
 * Os tokens Supabase permanecem em cookies HttpOnly no servidor.
 */
export type NexoSession = {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
  expires_at: number;
};

export type RemoteCollection = {
  data_key: string;
  payload: unknown;
  revision: number;
  updated_at: string;
};

async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a solicitação.");
  return data as T;
}

export async function getCurrentSession(): Promise<NexoSession | null> {
  const result = await request<{ session: NexoSession | null }>("/api/auth");
  return result.session;
}

export async function signInWithPassword(email: string, password: string) {
  const result = await request<{ session: NexoSession }>("/api/auth", "POST", { action: "login", email, password });
  if (!result.session) throw new Error("Não foi possível iniciar a sessão.");
  return result.session;
}

export async function signUpWithPassword(email: string, password: string, displayName: string) {
  const result = await request<{ session: NexoSession | null; confirmationRequired: boolean }>("/api/auth", "POST", {
    action: "signup", email, password, displayName,
  });
  return result;
}

export async function signOutSession() {
  await request<{ ok: boolean }>("/api/auth", "POST", { action: "logout" });
}

export async function requestPasswordReset(email: string) {
  await request<{ ok: boolean }>("/api/auth", "POST", { action: "recovery", email });
}

export async function setRecoverySession(accessToken: string, refreshToken: string, expiresIn: number) {
  const result = await request<{ session: NexoSession }>("/api/auth", "POST", {
    action: "recovery-session", access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn,
  });
  return result.session;
}

export async function updatePassword(password: string) {
  await request<{ ok: boolean }>("/api/auth", "POST", { action: "change-password", password });
}

export async function fetchRemoteCollections(): Promise<RemoteCollection[]> {
  const result = await request<{ data: RemoteCollection[] }>("/api/sync");
  return result.data;
}

export async function saveRemoteCollection(
  dataKey: string, payload: unknown, expectedRevision: number
): Promise<{ saved: boolean; current_revision: number | null; current_updated_at: string | null }> {
  const result = await request<{ result: { saved: boolean; current_revision: number | null; current_updated_at: string | null } }>(
    "/api/sync", "POST", { data_key: dataKey, payload, expected_revision: expectedRevision }
  );
  return result.result;
}

export const NEXO_SYNC_KEYS = [
  "nexo_transactions", "nexo_accounts", "nexo_reserves", "nexo_reserve_movements",
  "nexo_tasks", "nexo_habits", "nexo_preferences", "nexo_profile", "nexo_planning_budgets", "nexo_planning_goals",
] as const;

export type NexoSyncKey = (typeof NEXO_SYNC_KEYS)[number];

// Coleções que ainda dependem do mecanismo legado. Tarefas e hábitos
// agora são carregados e gravados diretamente no Supabase pelo hook próprio.
export const NEXO_LEGACY_SYNC_KEYS = NEXO_SYNC_KEYS.filter(
  (key) => !["nexo_tasks", "nexo_habits", "nexo_preferences", "nexo_profile", "nexo_planning_budgets", "nexo_planning_goals"].includes(key)
) as readonly Exclude<NexoSyncKey, "nexo_tasks" | "nexo_habits" | "nexo_preferences" | "nexo_profile" | "nexo_planning_budgets" | "nexo_planning_goals">[];
