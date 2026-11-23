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
]);

function copyCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // O E2E usa endpoints mockados e não deve depender de uma conta Supabase real.
  if (process.env.NODE_ENV !== "production" && process.env.NEXO_E2E_TEST_MODE === "true") {
    return NextResponse.next();
  }

  // As rotas de API fazem sua própria validação de sessão e origem.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const isPublicRoute = PUBLIC_ROUTES.has(pathname);
  const response = NextResponse.next();

  try {
    const accessToken = await getValidAccessToken(request, response);
    const user = accessToken ? await fetchSupabaseUser(accessToken) : null;

    if (user) {
      if (pathname === "/entrar" || pathname === "/cadastro") {
        return copyCookies(
          response,
          NextResponse.redirect(new URL("/", request.url))
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
    return copyCookies(response, NextResponse.redirect(loginUrl));
  } catch {
    if (isPublicRoute) {
      return response;
    }

    const loginUrl = new URL("/entrar", request.url);
    loginUrl.searchParams.set("next", pathname);
    return copyCookies(response, NextResponse.redirect(loginUrl));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
