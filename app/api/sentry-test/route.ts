import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.SENTRY_TEST_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied || supplied !== expected) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }

  const error = new Error("NEXO_SENTRY_TEST_EVENT — evento controlado de validação.");
  Sentry.captureException(error, { tags: { test_event: "true", source: "temporary-test-route" } });
  await Sentry.flush(2000);
  return NextResponse.json({ ok: true, message: "Evento de teste enviado ao Sentry." });
}
