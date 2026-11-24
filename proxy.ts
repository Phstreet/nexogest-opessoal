import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookies,
  fetchSupabaseUser,
  getValidAccessToken,
} from "@/lib/supabase/server";

const PUBLIC_ROUTES = new Set([
  "/entrar",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
  "/offline",
]);

const PUBLIC_PWA_PATHS = new Set([
  "/sw.js",
  "/manifest.webmanifest",
  "/offline-shell.html",
  "/offline.css",
]);

function createNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function createCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "style-src-attr 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://*.ingest.sentry.io https://*.sentry.io",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ].join("; ");
}

function secureResponse(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy-Report-Only", csp);
  response.headers.set("Reporting-Endpoints", 'csp-endpoint="/api/csp-report"');
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-Frame-Options", "DENY");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  response.headers.delete("X-Powered-By");
  return response;
}

function copyCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = createCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const nextResponse = () =>
    secureResponse(
      NextResponse.next({ request: { headers: requestHeaders } }),
      csp
    );

  const pathname = request.nextUrl.pathname;

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXO_E2E_TEST_MODE === "true"
  ) {
    return nextResponse();
  }

  if (pathname.startsWith("/api/")) {
    return nextResponse();
  }

  // O manifesto, o worker e o fallback offline são recursos públicos.
  // Não podem ser redirecionados para o login durante a instalação do PWA.
  if (PUBLIC_PWA_PATHS.has(pathname)) {
    return nextResponse();
  }

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const response = nextResponse();

  try {
    const accessToken = await getValidAccessToken(request, response);
    const user = accessToken ? await fetchSupabaseUser(accessToken) : null;

    if (user) {
      if (pathname === "/entrar" || pathname === "/cadastro") {
        const redirect = secureResponse(
          NextResponse.redirect(new URL("/", request.url)),
          csp
        );
        return copyCookies(response, redirect);
      }
      return response;
    }

    clearSessionCookies(response);
    if (isPublicRoute) return response;

    const loginUrl = new URL("/entrar", request.url);
    loginUrl.searchParams.set("next", pathname);
    return copyCookies(
      response,
      secureResponse(NextResponse.redirect(loginUrl), csp)
    );
  } catch {
    if (isPublicRoute) return response;

    const loginUrl = new URL("/entrar", request.url);
    loginUrl.searchParams.set("next", pathname);
    return copyCookies(
      response,
      secureResponse(NextResponse.redirect(loginUrl), csp)
    );
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|offline-shell\\.html|offline\\.css|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
