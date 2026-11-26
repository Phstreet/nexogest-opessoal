import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";

const URL_BASE = "https://mmwkpwspyjvxsennvhic.supabase.co";
const ANON_KEY = process.env.NEXO_DEV_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = process.env.NEXO_DEV_SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY) {
  throw new Error("Secret ausente: NEXO_DEV_SUPABASE_PUBLISHABLE_KEY (chave pública do NEXO-DEV).");
}
if (!SERVICE_KEY) {
  throw new Error("Secret ausente: NEXO_DEV_SUPABASE_SERVICE_ROLE_KEY (somente DEV).");
}
if (new URL(URL_BASE).hostname.split(".")[0] !== "mmwkpwspyjvxsennvhic") {
  throw new Error("Este teste só pode executar no projeto NEXO-DEV.");
}

async function api(path, { method = "GET", token, admin = false, body, prefer } = {}) {
  const key = admin ? SERVICE_KEY : ANON_KEY;
  const headers = { apikey: key };
  if (admin) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  else if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(new URL(path, URL_BASE), {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: response.ok, status: response.status, data };
}

async function user(slot) {
  const email = `nexo-rls-${slot}@example.com`;
  const password = randomBytes(32).toString("base64url");
  const listing = await api("/auth/v1/admin/users?page=1&per_page=1000", { admin: true });
  if (!listing.ok) throw new Error(`Admin users HTTP ${listing.status}`);
  const existing = (listing.data?.users ?? []).find((item) => item.email?.toLowerCase() === email);
  const saved = existing
    ? await api(`/auth/v1/admin/users/${existing.id}`, {
        method: "PUT", admin: true,
        body: { password, email_confirm: true, user_metadata: { nexo_test_user: true } },
      })
    : await api("/auth/v1/admin/users", {
        method: "POST", admin: true,
        body: { email, password, email_confirm: true, user_metadata: { nexo_test_user: true } },
      });
  if (!saved.ok) throw new Error(`Não foi possível preparar usuário ${slot}: HTTP ${saved.status}`);
  const id = existing?.id ?? (saved.data?.user ?? saved.data)?.id;
  const login = await api("/auth/v1/token?grant_type=password", {
    method: "POST", body: { email, password },
  });
  if (!login.ok || !login.data?.access_token || !id) {
    throw new Error(`Não foi possível autenticar usuário ${slot}: HTTP ${login.status}`);
  }
  return { id, email, password, jwt: login.data.access_token };
}

const tables = [
  { name: "nexo_profiles", row: (id) => ({ user_id: id, display_name: "RLS TEST PROFILE" }), filter: (r,id) => `user_id=eq.${id}`, field: "display_name", value: "RLS TEST PROFILE" },
  { name: "nexo_accounts", row: (id) => ({ user_id: id, name: "RLS TEST ACCOUNT", account_type: "checking" }), filter: (r) => `id=eq.${r.id}`, field: "name", value: "RLS TEST ACCOUNT" },
  { name: "nexo_categories", row: (id) => ({ user_id: id, name: "RLS TEST CATEGORY", kind: "expense" }), filter: (r) => `id=eq.${r.id}`, field: "name", value: "RLS TEST CATEGORY" },
  { name: "nexo_transactions_relational", row: (id) => ({ user_id: id, description: "RLS TEST TRANSACTION", amount_cents: 1234, kind: "expense", occurred_on: "2026-11-26" }), filter: (r) => `id=eq.${r.id}`, field: "description", value: "RLS TEST TRANSACTION" },
  { name: "nexo_goals_relational", row: (id) => ({ user_id: id, title: "RLS TEST GOAL", target_cents: 5000 }), filter: (r) => `id=eq.${r.id}`, field: "title", value: "RLS TEST GOAL" },
  { name: "nexo_routine_items", row: (id) => ({ user_id: id, item_type: "task", title: "RLS TEST ROUTINE" }), filter: (r) => `id=eq.${r.id}`, field: "title", value: "RLS TEST ROUTINE" },
];

async function rest(test, method, jwt, query, body) {
  return api(`/rest/v1/${test.name}?${query}`, {
    method, token: jwt, body, prefer: "return=representation",
  });
}

async function verify(test, a, b) {
  const created = await rest(test, "POST", b.jwt, "select=*", test.row(b.id));
  if (!created.ok || !Array.isArray(created.data) || created.data.length !== 1) {
    throw new Error(`Falha ao criar fixture em ${test.name}: HTTP ${created.status}`);
  }
  const row = created.data[0];
  const filter = test.filter(row, b.id);
  try {
    const readA = await rest(test, "GET", a.jwt, `select=*&${filter}`);
    if (!readA.ok || readA.data?.length !== 0) throw new Error(`A leu dados de B em ${test.name}`);

    const updateA = await rest(test, "PATCH", a.jwt, filter, { [test.field]: "UNAUTHORIZED UPDATE" });
    if (!updateA.ok || updateA.data?.length !== 0) throw new Error(`A alterou dados de B em ${test.name}`);

    const deleteA = await rest(test, "DELETE", a.jwt, filter);
    if (!deleteA.ok || deleteA.data?.length !== 0) throw new Error(`A excluiu dados de B em ${test.name}`);

    const readB = await rest(test, "GET", b.jwt, `select=*&${filter}`);
    if (!readB.ok || readB.data?.length !== 1 || readB.data[0][test.field] !== test.value) {
      throw new Error(`A integridade dos dados de B foi comprometida em ${test.name}`);
    }
    console.log(`RLS PASS ${test.name}: leitura, alteração e exclusão isoladas por JWT.`);
  } finally {
    const cleanup = await rest(test, "DELETE", b.jwt, filter);
    if (!cleanup.ok) throw new Error(`Falha na limpeza de fixture em ${test.name}: HTTP ${cleanup.status}`);
  }
}

const [a, b] = await Promise.all([user("a"), user("b")]);
if (a.id === b.id) throw new Error("Usuários A e B não são distintos.");
console.log(`Usuários de teste DEV preparados: A=${a.id}; B=${b.id}`);
if (process.env.GITHUB_ENV) {
  for (const [slot, testUser] of [["A", a], ["B", b]]) {
    process.stdout.write(`::add-mask::${testUser.password}\n`);
    appendFileSync(
      process.env.GITHUB_ENV,
      `NEXO_DEV_TEST_USER_${slot}_EMAIL=${testUser.email}\nNEXO_DEV_TEST_USER_${slot}_PASSWORD=${testUser.password}\n`,
    );
  }
}
for (const test of tables) await verify(test, a, b);
console.log("RLS ISOLATION PASS: 6/6 tabelas verificadas com JWT de usuário; service role usado somente para provisionamento.");
