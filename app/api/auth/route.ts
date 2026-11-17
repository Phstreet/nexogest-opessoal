import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookies, fetchSupabaseUser, getSupabaseConfig,
  getValidAccessToken, setSessionCookies, hasValidOrigin,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

async function readAuthError(response: Response) {
  const body = await response.json().catch(() => ({}));
  return body.msg || body.message || body.error_description || body.error || "Não foi possível concluir a solicitação.";
}

export async function GET(request: NextRequest) {
  const response = NextResponse.json({ session: null });
  try {
    const access = await getValidAccessToken(request, response);
    if (!access) return response;
    const user = await fetchSupabaseUser(access);
    if (!user) {
      clearSessionCookies(response);
      return response;
    }
    return NextResponse.json({
      session: { user, expires_at: Number(request.cookies.get("nexo_token_expires_at")?.value || Math.floor(Date.now() / 1000) + 300) },
    }, { headers: response.headers });
  } catch (error) {
    clearSessionCookies(response);
    return NextResponse.json({ session: null, error: error instanceof Error ? error.message : "Falha ao validar sessão." }, { headers: response.headers });
  }
}

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Origem da solicitação não autorizada." }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }

  try {
    const { url, key } = getSupabaseConfig();
    const action = String(body.action || "");
    if (action === "login" || action === "signup") {
      const endpoint = action === "login"
        ? `${url}/auth/v1/token?grant_type=password`
        : `${url}/auth/v1/signup?redirect_to=${encodeURIComponent(new URL("/entrar", request.url).origin)}`;
      const payload = action === "login"
        ? { email: body.email, password: body.password }
        : { email: body.email, password: body.password, data: { display_name: body.displayName } };
      const authResponse = await fetch(endpoint, {
        method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify(payload), cache: "no-store",
      });
      if (!authResponse.ok) return NextResponse.json({ error: await readAuthError(authResponse) }, { status: authResponse.status });
      const data = await authResponse.json();
      const response = NextResponse.json({
        session: data.access_token ? { user: data.user, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600) } : null,
        confirmationRequired: !data.access_token,
      });
      if (data.access_token && data.refresh_token) setSessionCookies(response, data);
      return response;
    }

    if (action === "recovery") {
      const redirect = new URL("/redefinir-senha", request.url).toString();
      const authResponse = await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirect)}`, {
        method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ email: body.email }), cache: "no-store",
      });
      if (!authResponse.ok) return NextResponse.json({ error: await readAuthError(authResponse) }, { status: authResponse.status });
      return NextResponse.json({ ok: true });
    }

    if (action === "recovery-session") {
      const access = String(body.access_token || "");
      const refresh = String(body.refresh_token || "");
      if (!access || !refresh) return NextResponse.json({ error: "Link de recuperação inválido ou expirado." }, { status: 400 });
      const user = await fetchSupabaseUser(access);
      if (!user) return NextResponse.json({ error: "Não foi possível validar o link de recuperação. Solicite outro e-mail." }, { status: 401 });
      const response = NextResponse.json({ session: { user, expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in || 3600) } });
      setSessionCookies(response, { access_token: access, refresh_token: refresh, expires_in: Number(body.expires_in || 3600) });
      return response;
    }

    if (action === "change-password") {
      const response = NextResponse.json({ ok: false });
      const access = await getValidAccessToken(request, response);
      if (!access) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401, headers: response.headers });
      const update = await fetch(`${url}/auth/v1/user`, {
        method: "PUT", headers: { apikey: key, Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: body.password }), cache: "no-store",
      });
      if (!update.ok) return NextResponse.json({ error: await readAuthError(update) }, { status: update.status, headers: response.headers });
      return NextResponse.json({ ok: true }, { headers: response.headers });
    }

    if (action === "logout") {
      const response = NextResponse.json({ ok: true });
      const access = request.cookies.get("nexo_access_token")?.value;
      if (access) {
        await fetch(`${url}/auth/v1/logout`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${access}` }, cache: "no-store" }).catch(() => undefined);
      }
      clearSessionCookies(response);
      return response;
    }
    return NextResponse.json({ error: "Ação de autenticação desconhecida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno de autenticação." }, { status: 500 });
  }
}
