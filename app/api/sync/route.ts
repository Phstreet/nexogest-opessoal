import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig, getValidAccessToken } from "@/lib/supabase/server";

export const runtime = "nodejs";
const ALLOWED_KEYS = new Set([
  "nexo_transactions", "nexo_accounts", "nexo_reserves", "nexo_reserve_movements",
  "nexo_tasks", "nexo_habits", "nexo_preferences", "nexo_profile",
]);

async function authorized(request: NextRequest) {
  const response = NextResponse.json({});
  const access = await getValidAccessToken(request, response);
  return { access, response };
}

export async function GET(request: NextRequest) {
  try {
    const { access, response } = await authorized(request);
    if (!access) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers: response.headers });
    const { url, key } = getSupabaseConfig();
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${access}` }, cache: "no-store" });
    if (!userResponse.ok) return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: response.headers });
    const user = await userResponse.json();
    const query = new URLSearchParams({ select: "data_key,payload,revision,updated_at", user_id: `eq.${user.id}`, order: "data_key.asc" });
    const dataResponse = await fetch(`${url}/rest/v1/nexo_user_data?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${access}` }, cache: "no-store",
    });
    const data = await dataResponse.json().catch(() => ({}));
    if (!dataResponse.ok) return NextResponse.json({ error: data.message || "Não foi possível consultar os dados." }, { status: dataResponse.status, headers: response.headers });
    return NextResponse.json({ data }, { headers: response.headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao consultar a nuvem." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dataKey = String(body.data_key || "");
    const revision = Number(body.expected_revision);
    if (!ALLOWED_KEYS.has(dataKey) || !Number.isInteger(revision) || revision < 0) {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 });
    }
    const { access, response } = await authorized(request);
    if (!access) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers: response.headers });
    const { url, key } = getSupabaseConfig();
    const save = await fetch(`${url}/rest/v1/rpc/save_nexo_user_data`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_data_key: dataKey, p_payload: body.payload, p_expected_revision: revision }),
      cache: "no-store",
    });
    const result = await save.json().catch(() => ({}));
    if (!save.ok) return NextResponse.json({ error: result.message || result.details || "Não foi possível salvar na nuvem." }, { status: save.status, headers: response.headers });
    return NextResponse.json({ result: Array.isArray(result) ? result[0] : result }, { headers: response.headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao salvar na nuvem." }, { status: 500 });
  }
}
