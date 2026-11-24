import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const report = await request.json() as Record<string, unknown>;
    const raw = (report["csp-report"] ?? report.body ?? report) as Record<string, unknown>;
    const directive = String(raw["violated-directive"] ?? raw["effectiveDirective"] ?? "unknown").slice(0, 120);
    const blocked = String(raw["blocked-uri"] ?? raw["blockedURL"] ?? "unknown").slice(0, 160);
    const document = String(raw["document-uri"] ?? raw["documentURL"] ?? "unknown").split("?")[0].slice(0, 160);
    console.warn("[NEXO][CSP-REPORT]", { directive, blocked, document });
  } catch {
    // Relatórios malformados são descartados sem registrar o corpo enviado.
  }
  return new NextResponse(null, { status: 204 });
}
