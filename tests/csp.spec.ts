import { test, expect, type Page } from "@playwright/test";

const session = {
  user: {
    id: "nexo-csp-e2e",
    email: "csp-test@nexo.invalid",
    user_metadata: { display_name: "Teste CSP" },
  },
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

const routes = [
  "/",
  "/entrar",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
  "/configuracoes",
  "/metas",
  "/configuracoes/conta",
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

async function mockNexoApi(page: Page) {
  await page.route("**/api/auth", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { session } });
      return;
    }
    await route.fulfill({ json: { session, ok: true, confirmationRequired: false } });
  });
  await page.route("**/api/sync**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { data: [] } });
      return;
    }
    await route.fulfill({
      json: {
        result: {
          saved: true,
          current_revision: 1,
          current_updated_at: new Date().toISOString(),
        },
      },
    });
  });
}

test.describe("CSP Report-Only — rotas do NEXO", () => {
  for (const route of routes) {
    test(`não gera violações CSP em ${route}`, async ({ page }) => {
      await mockNexoApi(page);
      await page.addInitScript(() => {
        const target = window as Window & {
          __nexoCspViolations?: Array<{
            directive: string;
            blockedURI: string;
            disposition: string;
          }>;
        };
        target.__nexoCspViolations = [];
        window.addEventListener("securitypolicyviolation", (event) => {
          target.__nexoCspViolations?.push({
            directive: event.effectiveDirective,
            blockedURI: event.blockedURI,
            disposition: event.disposition,
          });
        });
      });

      const cspConsoleMessages: string[] = [];
      page.on("console", (message) => {
        if (/content security policy|violates the following/i.test(message.text())) {
          cspConsoleMessages.push(message.text());
        }
      });

      const response = await page.goto(route);
      expect(response, `A rota ${route} não respondeu`).not.toBeNull();
      expect(response!.status(), `Status inesperado em ${route}`).toBeLessThan(400);
      await page.waitForLoadState("load");
      await page.waitForTimeout(300);

      const violations = await page.evaluate(() => {
        return (window as Window & {
          __nexoCspViolations?: Array<{
            directive: string;
            blockedURI: string;
            disposition: string;
          }>;
        }).__nexoCspViolations ?? [];
      });
      expect(violations, `Violações CSP em ${route}`).toEqual([]);
      expect(cspConsoleMessages, `Avisos CSP no console em ${route}`).toEqual([]);
    });
  }
});
