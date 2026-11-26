import { test, expect } from "@playwright/test";

const protectedRoutes = [
  "/",
  "/cadastro",
  "/entrar",
  "/recuperar-senha",
  "/redefinir-senha",
  "/metas",
  "/configuracoes/conta",
  "/configuracoes",
  "/perfil",
  "/financeiro",
  "/financeiro/dashboard",
  "/financeiro/contas",
  "/financeiro/contas-a-pagar",
  "/financeiro/contas-a-receber",
  "/financeiro/historico",
  "/financeiro/investimentos",
  "/financeiro/reservas",
  "/financeiro/planejamento",
  "/relatorios",
  "/rotina",
  "/rotina/agenda",
  "/rotina/tarefas",
  "/rotina/habitos",
  "/rotina/metas",
  "/rotina/planejamento",
  "/rotina/produtividade",
];

test("CSP nonce é emitido em todas as rotas privadas sem violações de script", async ({ page }) => {
  await page.route("**/api/auth", async (route) => {
    await route.fulfill({
      json: {
        session: null,
      },
    });
  });
  await page.route("**/api/sync**", async (route) => {
    await route.fulfill({ json: { data: [] } });
  });
  await page.route("**/_vercel/insights/script.js", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });

  const violations: string[] = [];
  const nonces = new Set<string>();
  page.on("console", (message) => {
    if (/content security policy|violates the following directive|blocked by csp/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  for (const route of protectedRoutes) {
    const response = await page.goto(route);
    expect(response, `Sem resposta para ${route}`).not.toBeNull();
    expect(response!.status(), `Status inválido em ${route}`).toBeLessThan(400);

    const csp = response!.headers()["content-security-policy"] ?? "";
    const scriptDirective = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src")) ?? "";
    expect(scriptDirective, `script-src ausente em ${route}`).toContain("'nonce-");
    expect(scriptDirective, `unsafe-inline ainda presente em ${route}`).not.toContain("'unsafe-inline'");

    const nonce = scriptDirective.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce, `Nonce inválido em ${route}`).toBeTruthy();
    nonces.add(nonce!);

    const inlineScriptsWithoutNonce = await page.locator("script:not([src])").evaluateAll((scripts) =>
      scripts
        .filter((script) => (script.textContent ?? "").trim().length > 0)
        .filter((script) => !(script as HTMLScriptElement).nonce)
        .length
    );
    expect(inlineScriptsWithoutNonce, `Script inline sem nonce em ${route}`).toBe(0);
  }

  expect(nonces.size, "Cada resposta deve usar um nonce exclusivo").toBe(protectedRoutes.length);
  expect(violations).toEqual([]);
});
