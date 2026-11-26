import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRequestClient } from "@/lib/supabase/ssr-request";
import { createSupabaseServerClient } from "@/lib/supabase/ssr-server";
import {
  clearSessionCookies, copyResponseCookies, fetchSupabaseUser, getSupabaseConfig,
  getValidAccessToken, setSessionCookies, hasValidOrigin,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

async function readAuthError(response: Response) {
  await response.json().catch(() => ({}));
  if (response.status === 400 || response.status === 401) return "E-mail, senha ou dados de autenticação inválidos.";
  if (response.status === 422) return "Os dados informados não atendem aos requisitos da conta.";
  if (response.status === 429) return "Muitas tentativas em pouco tempo. Aguarde antes de tentar novamente.";
  return "Não foi possível concluir a solicitação. Tente novamente mais tarde.";
}

export async function GET() {
  try {
    // O proxy renova a sessão e sincroniza cookies SSR/legados antes do Route Handler.
    const supabase = await createSupabaseServerClient();
    const [{ data: userData, error }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);

    if (error || !userData.user || !sessionData.session) {
      return NextResponse.json({ session: null });
    }

    return NextResponse.json({
      session: {
        user: userData.user,
        expires_at: sessionData.session.expires_at ??
          Math.floor(Date.now() / 1000) + sessionData.session.expires_in,
      },
    });
  } catch {
    return NextResponse.json({
      session: null,
      error: "Não foi possível validar a sessão. Entre novamente.",
    });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }

  const action = String(body.action || "");
  // Cadastro público permanece fechado até a aprovação integral do checklist de lançamento.
  // A abertura exige configuração explícita no servidor; ausência da variável significa fechado.
  // Esta rejeição antecipada não executa operações nem depende de uma origem confiável.
  if (action === "signup" && process.env.NEXO_SIGNUP_ENABLED !== "true") {
    return NextResponse.json(
      { error: "O cadastro público do NEXO está temporariamente fechado. O acesso será liberado após a conclusão da validação de segurança." },
      { status: 403 }
    );
  }

  // Todas as demais ações, inclusive signup quando habilitado, exigem origem same-origin.
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origem da solicitação não autorizada." }, { status: 403 });
  }

  try {
    const { url, key } = getSupabaseConfig();
    if (action === "login" || action === "signup") {
      if (action === "signup" && (typeof body.password !== "string" || body.password.length < 8)) {
        return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
      }
      if (typeof body.email !== "string" || !body.email.trim()) {
        return NextResponse.json({ error: "Informe um endereço de e-mail válido." }, { status: 400 });
      }
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
      const user = data.user || (data.id ? data : data.access_token ? await fetchSupabaseUser(data.access_token) : null);
      const hasSession = Boolean(data.access_token && data.refresh_token && user);
      const response = NextResponse.json({
        session: hasSession ? { user, expires_at: Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600) } : null,
        confirmationRequired: !hasSession,
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
      const expiresIn = Number(body.expires_in ?? 3600);
      if (!access || !refresh || !Number.isFinite(expiresIn) || expiresIn < 60 || expiresIn > 86400) {
        return NextResponse.json({ error: "Link de recuperação inválido ou expirado." }, { status: 400 });
      }
      const user = await fetchSupabaseUser(access);
      if (!user) return NextResponse.json({ error: "Não foi possível validar o link de recuperação. Solicite outro e-mail." }, { status: 401 });
      const response = NextResponse.json({ session: { user, expires_at: Math.floor(Date.now() / 1000) + expiresIn } });
      setSessionCookies(response, { access_token: access, refresh_token: refresh, expires_in: expiresIn });
      return response;
    }

    if (action === "change-password") {
      if (typeof body.password !== "string" || body.password.length < 8) {
        return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
      }
      const response = NextResponse.json({ ok: false });
      const access = await getValidAccessToken(request, response);
      if (!access) return copyResponseCookies(response, NextResponse.json({ error: "Sua sessão expirou. Entre novamente." }, { status: 401, headers: response.headers }));
      const update = await fetch(`${url}/auth/v1/user`, {
        method: "PUT", headers: { apikey: key, Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: body.password }), cache: "no-store",
      });
      if (!update.ok) return copyResponseCookies(response, NextResponse.json({ error: await readAuthError(update) }, { status: update.status, headers: response.headers }));
      return copyResponseCookies(response, NextResponse.json({ ok: true }, { headers: response.headers }));
    }

    if (action === "logout") {
      const response = NextResponse.json({ ok: true });
      const access = request.cookies.get("nexo_access_token")?.value;
      if (access) {
        await fetch(`${url}/auth/v1/logout`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${access}` }, cache: "no-store" }).catch(() => undefined);
      }
      // Revoga a sessão local do SDK SSR e remove os cookies legados.
      const supabase = createSupabaseRequestClient(request, response);
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      clearSessionCookies(response);
      return response;
    }
    return NextResponse.json({ error: "Ação de autenticação desconhecida." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Não foi possível concluir a operação de autenticação. Tente novamente." }, { status: 500 });
  }
}
