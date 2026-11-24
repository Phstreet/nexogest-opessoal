import { NextRequest, NextResponse } from "next/server";
import { copyResponseCookies, getSupabaseConfig, getValidAccessToken, hasValidOrigin } from "@/lib/supabase/server";
import { isNexoSyncKey } from "@/lib/supabase/sync-keys";
import { isValidBackupCollection } from "@/lib/supabase/backup";
import { userSettingsSchema } from "@/lib/settings/schema";
import { userProfileSchema } from "@/lib/settings/profile-schema";

export const runtime = "nodejs";

const MAX_SYNC_BODY_BYTES = 1_048_576;

async function authorized(request: NextRequest) {
  const response = NextResponse.json({});
  const access = await getValidAccessToken(request, response);
  return { access, response };
}

export async function GET(request: NextRequest) {
  try {
    const { access, response } = await authorized(request);
    if (!access) return copyResponseCookies(response, NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers: response.headers }));

    const requestedKeys = request.nextUrl.searchParams.get("keys");
    let keys: string[] | null = null;
    if (requestedKeys) {
      keys = [...new Set(requestedKeys.split(",").map((key) => key.trim()).filter(Boolean))];
      if (!keys.length || keys.some((key) => !isNexoSyncKey(key))) {
        return NextResponse.json({ error: "Uma ou mais coleções solicitadas não são permitidas." }, { status: 400, headers: response.headers });
      }
    }

    const { url, key } = getSupabaseConfig();
    const query = new URLSearchParams({ select: "data_key,payload,revision,updated_at", order: "data_key.asc" });
    if (keys) query.set("data_key", `in.(${keys.join(",")})`);

    // A política RLS restringe os registros ao auth.uid() do JWT.
    // Não é necessário consultar /auth/v1/user para filtrar novamente por user_id.
    const dataResponse = await fetch(`${url}/rest/v1/nexo_user_data?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${access}` }, cache: "no-store",
    });
    const data = await dataResponse.json().catch(() => ({}));
    if (!dataResponse.ok) return copyResponseCookies(response, NextResponse.json({ error: data.message || "Não foi possível consultar os dados." }, { status: dataResponse.status, headers: response.headers }));
    return copyResponseCookies(response, NextResponse.json({ data }, { headers: response.headers }));
  } catch {
    return NextResponse.json({ error: "Falha ao consultar os dados da nuvem." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Origem da solicitação não autorizada." }, { status: 403 });
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_SYNC_BODY_BYTES) {
      return NextResponse.json({ error: "O conteúdo excede o limite de 1 MB por coleção." }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Formato de sincronização inválido." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const dataKey = typeof body.data_key === "string" ? body.data_key : "";
    const revision = Number(body.expected_revision);
    if (!isNexoSyncKey(dataKey) || !Number.isSafeInteger(revision) || revision < 0) {
      return NextResponse.json({ error: "Dados de sincronização inválidos." }, { status: 400 });
    }
    const payload = body.payload;
    if (!isValidBackupCollection(dataKey, payload)) {
      return NextResponse.json({ error: "A coleção contém registros inválidos ou incompatíveis. Nenhum dado foi gravado." }, { status: 400 });
    }

    if (dataKey === "nexo_preferences" && payload && typeof payload === "object" && !Array.isArray(payload)) {
      const settingsPayload = (payload as Record<string, unknown>).settingsV1;
      if (settingsPayload !== undefined && !userSettingsSchema.safeParse(settingsPayload).success) {
        return NextResponse.json({ error: "As preferências possuem campos inválidos ou versão incompatível." }, { status: 400 });
      }
    }
    if (dataKey === "nexo_profile" && !userProfileSchema.safeParse(payload).success) {
      return NextResponse.json({ error: "Os dados do perfil são inválidos." }, { status: 400 });
    }
    const { access, response } = await authorized(request);
    if (!access) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401, headers: response.headers });
    const { url, key } = getSupabaseConfig();
    const save = await fetch(`${url}/rest/v1/rpc/save_nexo_user_data`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_data_key: dataKey, p_payload: payload, p_expected_revision: revision }),
      cache: "no-store",
    });
    const result = await save.json().catch(() => ({}));
    if (!save.ok) return copyResponseCookies(response, NextResponse.json({ error: result.message || result.details || "Não foi possível salvar na nuvem." }, { status: save.status, headers: response.headers }));
    return copyResponseCookies(response, NextResponse.json({ result: Array.isArray(result) ? result[0] : result }, { headers: response.headers }));
  } catch {
    return NextResponse.json({ error: "Falha ao salvar os dados na nuvem." }, { status: 500 });
  }
}
