import { NextRequest, NextResponse } from "next/server";
import { bridgeLegacySession } from "@/lib/supabase/ssr-request";
import { clearSessionCookies } from "@/lib/supabase/server";

const PUBLIC_ROUTES = new Set([
  "/entrar",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
]);

function buildContentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "'" + (isDev ? " 'unsafe-eval'" : "") + " https://va.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function withSecurityHeaders(response: NextResponse, csp: string) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

function copyCookies(source: NextResponse, target: NextResponse, csp: string) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return withSecurityHeaders(target, csp);
}

export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  // O Next.js lê o nonce do CSP da requisição e o aplica aos scripts gerados.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    csp,
  );

  // Os testes E2E isolam o Auth real, mas continuam exercitando a política CSP.
  const isE2ETest =
    process.env.NEXO_E2E_TEST_MODE === "true" &&
    (process.env.NODE_ENV !== "production" || process.env.CI === "true");

  if (isE2ETest) {
    return response;
  }

  const pathname = request.nextUrl.pathname;
  let authenticated = false;

  try {
    const session = await bridgeLegacySession(request, response);
    authenticated = session.authenticated;
  } catch {
    clearSessionCookies(response);
  }

  // APIs fazem sua própria autorização; o proxy apenas mantém os cookies SSR sincronizados.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  if (authenticated) {
    if (pathname === "/entrar" || pathname === "/cadastro") {
      return copyCookies(
        response,
        NextResponse.redirect(new URL("/", request.url)),
        csp,
      );
    }
    return response;
  }

  clearSessionCookies(response);

  if (isPublicRoute) {
    return response;
  }

  const loginUrl = new URL("/entrar", request.url);
  loginUrl.searchParams.set("next", pathname);
  return copyCookies(response, NextResponse.redirect(loginUrl), csp);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
