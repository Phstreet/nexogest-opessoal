import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function safeResource(value: unknown): string {
  if (typeof value !== "string" || !value) return "unknown";
  try {
    return new URL(value).origin;
  } catch {
    return /^(inline|eval|data:|blob:)/i.test(value) ? value.slice(0, 24) : "other";
  }
}

export async function POST(request: NextRequest) {
  try {
    const report = await request.json() as Record<string, unknown>;
    const raw = (report["csp-report"] ?? report.body ?? report) as Record<string, unknown>;
    const directive = String(raw["violated-directive"] ?? raw["effectiveDirective"] ?? "unknown").slice(0, 120);
    const blocked = safeResource(raw["blocked-uri"] ?? raw["blockedURL"]);
    const document = safeResource(raw["document-uri"] ?? raw["documentURL"]);
    console.warn("[NEXO][CSP-REPORT]", { directive, blocked, document });
  } catch {
    // Relatórios malformados são descartados sem registrar o corpo enviado.
  }
  return new NextResponse(null, { status: 204 });
}
