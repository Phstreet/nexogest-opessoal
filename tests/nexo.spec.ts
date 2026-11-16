import { test, expect } from "@playwright/test";

const financePages = [
  "/financeiro",
  "/financeiro/dashboard",
  "/financeiro/contas",
  "/financeiro/contas-a-pagar",
  "/financeiro/contas-a-receber",
  "/financeiro/historico",
  "/financeiro/investimentos",
  "/financeiro/reservas",
  "/financeiro/planejamento"
];

const routinePages = [
  "/rotina",
  "/rotina/agenda",
  "/rotina/tarefas",
  "/rotina/habitos",
  "/rotina/planejamento",
  "/rotina/produtividade"
];

// Cada teste recebe um contexto isolado do navegador pelo Playwright.
// Portanto, não é necessário limpar o localStorage navegando pela página inicial.

test.describe("NEXO - Navegação e carregamento", () => {
  for (const route of [...financePages, ...routinePages]) {
    test(`deve carregar ${route} sem erro de execução`, async ({ page }) => {
      const pageErrors: string[] = [];

      page.on("pageerror", (error) => {
        pageErrors.push(error.message);
      });

      const response = await page.goto(route);

      expect(response, `A rota ${route} não retornou uma resposta`).not.toBeNull();
      expect(response!.status()).toBeLessThan(400);

      await expect(page.locator("h1, h2").first()).toBeVisible();

      expect(pageErrors).toEqual([]);
    });
  }
});

test.describe("Financeiro - Cadastro de contas", () => {
  test("deve cadastrar uma conta e salvar no armazenamento", async ({ page }) => {
    await page.goto("/financeiro/contas");

    await page.getByLabel("Nome da conta").fill("Conta de teste NEXO");
    await page.getByLabel("Banco / Instituição").selectOption({ label: "Nubank" });
    await page.getByLabel("Tipo de conta").selectOption({ label: "Conta corrente" });
    await page.getByLabel("Saldo inicial (R$)").fill("1500,00");

    await page.getByRole("button", { name: "Cadastrar conta" }).click();

    await expect(page.getByText("Conta de teste NEXO")).toBeVisible();

    const savedAccounts = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("nexo_accounts") || "[]");
    });

    expect(savedAccounts).toHaveLength(1);
    expect(savedAccounts[0].name).toBe("Conta de teste NEXO");
    expect(savedAccounts[0].initialBalance).toBe(1500);
  });

  test("deve manter a conta após atualizar a página", async ({ page }) => {
    await page.goto("/financeiro/contas");

    await page.getByLabel("Nome da conta").fill("Conta persistente");
    await page.getByLabel("Saldo inicial (R$)").fill("500");

    await page.getByRole("button", { name: "Cadastrar conta" }).click();
    await expect(page.getByText("Conta persistente")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Conta persistente")).toBeVisible();
  });

  test("deve desativar uma conta sem excluí-la", async ({ page }) => {
    await page.goto("/financeiro/contas");

    await page.getByLabel("Nome da conta").fill("Conta para desativar");
    await page.getByLabel("Saldo inicial (R$)").fill("800");
    await page.getByRole("button", { name: "Cadastrar conta" }).click();

    const accountItem = page.locator(".accounts-item").filter({
      hasText: "Conta para desativar"
    });

    await expect(accountItem).toBeVisible();
    await accountItem.getByRole("button", { name: "Desativar", exact: true }).click();

    await expect(accountItem.getByText("Inativa")).toBeVisible();
    await expect(
      accountItem.getByRole("button", { name: "Ativar", exact: true })
    ).toBeVisible();

    const savedAccounts = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("nexo_accounts") || "[]");
    });

    expect(savedAccounts).toHaveLength(1);
    expect(savedAccounts[0].name).toBe("Conta para desativar");
    expect(savedAccounts[0].active).toBe(false);
  });

  test("deve excluir uma conta somente após confirmação", async ({ page }) => {
    await page.goto("/financeiro/contas");

    await page.getByLabel("Nome da conta").fill("Conta para excluir");
    await page.getByLabel("Saldo inicial (R$)").fill("250");
    await page.getByRole("button", { name: "Cadastrar conta" }).click();

    const accountItem = page.locator(".accounts-item").filter({
      hasText: "Conta para excluir"
    });

    await expect(accountItem).toBeVisible();

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("excluir definitivamente");
      await dialog.accept();
    });

    await accountItem.getByRole("button", {
      name: "Excluir conta Conta para excluir"
    }).click();

    await expect(accountItem).toHaveCount(0);

    const savedAccounts = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("nexo_accounts") || "[]");
    });

    expect(savedAccounts).toHaveLength(0);
  });
});

test.describe("Financeiro - Integração de contas e transferências", () => {
  test("deve disponibilizar contas cadastradas no formulário de lançamentos", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "nexo_accounts",
        JSON.stringify([
          {
            id: 91001,
            name: "Conta principal NEXO",
            institution: "Nubank",
            type: "Conta corrente",
            initialBalance: 1200,
            createdAt: "2026-11-16",
            active: true
          }
        ])
      );
    });

    await page.goto("/financeiro");

    const accountField = page
      .locator(".finance-field")
      .filter({ hasText: "Conta financeira" })
      .locator("select");

    await expect(accountField).toHaveValue("Conta principal NEXO");
    await expect(
      accountField.locator('option[value="Conta principal NEXO"]')
    ).toHaveCount(1);
  });

  test("deve registrar uma transferência efetivada entre contas cadastradas", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "nexo_accounts",
        JSON.stringify([
          {
            id: 91002,
            name: "Conta de origem NEXO",
            institution: "Nubank",
            type: "Conta corrente",
            initialBalance: 1500,
            createdAt: "2026-11-16",
            active: true
          },
          {
            id: 91003,
            name: "Conta de destino NEXO",
            institution: "Banco Inter",
            type: "Conta corrente",
            initialBalance: 300,
            createdAt: "2026-11-16",
            active: true
          }
        ])
      );
    });

    await page.goto("/financeiro");

    await page
      .locator(".finance-field")
      .filter({ hasText: "Tipo" })
      .locator("select")
      .selectOption({ label: "Transferência" });

    await page.locator(".field-description input").fill("Transferência entre minhas contas");
    await page
      .locator(".finance-field")
      .filter({ hasText: "Valor (R$)" })
      .locator("input")
      .fill("250,00");

    await page
      .locator(".finance-field")
      .filter({
        has: page.locator("label", { hasText: /^Conta de origem$/ })
      })
      .locator("select")
      .selectOption({ label: "Conta de origem NEXO" });

    await page
      .locator(".finance-field")
      .filter({
        has: page.locator("label", { hasText: /^Conta de destino$/ })
      })
      .locator("select")
      .selectOption({ label: "Conta de destino NEXO" });

    await page
      .locator(".finance-field")
      .filter({ hasText: "Status" })
      .locator("select")
      .selectOption({ label: "Realizada" });

    await page.getByRole("button", { name: "Adicionar lançamento" }).click();

    await expect.poll(
      () => page.evaluate(() => {
        const transactions = JSON.parse(
          localStorage.getItem("nexo_transactions") || "[]"
        );

        return transactions.some((item: {
          type: string;
          description: string;
          amount: number;
          account: string;
          destinationAccount: string;
          status: string;
        }) =>
          item.type === "Transferência" &&
          item.description === "Transferência entre minhas contas" &&
          item.amount === 250 &&
          item.account === "Conta de origem NEXO" &&
          item.destinationAccount === "Conta de destino NEXO" &&
          item.status === "Realizada"
        );
      }),
      {
        message: "A transferência efetivada deve ser salva com origem, destino, valor e status corretos."
      }
    ).toBe(true);
  });
});

test.describe("Rotina - Cadastro de tarefas", () => {
  test("deve cadastrar uma tarefa", async ({ page }) => {
    await page.goto("/rotina/tarefas");

    await page.getByRole("button", { name: /Nova tarefa/ }).click();

    await page.getByLabel("Descrição da tarefa *").fill("Tarefa automatizada NEXO");

    await page.getByRole("button", { name: "Cadastrar tarefa" }).click();
    await expect(page.getByText("Tarefa automatizada NEXO")).toBeVisible();

    const savedTasks = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("nexo_tasks") || "[]");
    });

    expect(
      savedTasks.some(
        (task: { description: string }) =>
          task.description === "Tarefa automatizada NEXO"
      )
    ).toBeTruthy();
  });

  test("deve preservar a tarefa após atualizar a página", async ({ page }) => {
    await page.goto("/rotina/tarefas");

    await page.getByRole("button", { name: /Nova tarefa/ }).click();
    await page.getByLabel("Descrição da tarefa *").fill("Tarefa persistente");

    await page.getByRole("button", { name: "Cadastrar tarefa" }).click();
    await expect(page.getByText("Tarefa persistente")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Tarefa persistente")).toBeVisible();
  });
});

test.describe("Rotina - Cadastro de hábitos", () => {
  test("deve cadastrar um hábito", async ({ page }) => {
    await page.goto("/rotina/habitos");

    await page.getByRole("button", { name: /Novo hábito/ }).click();
    await expect(page.locator("#habit-form")).toBeVisible();

    await page.locator("#habit-name").fill("Hábito automatizado NEXO");

    await page.getByRole("button", { name: "Cadastrar hábito" }).click();
    await expect(page.getByText("Hábito automatizado NEXO")).toBeVisible();

    const savedHabits = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem("nexo_habits") || "[]");
    });

    expect(
      savedHabits.some(
        (habit: { name: string }) =>
          habit.name === "Hábito automatizado NEXO"
      )
    ).toBeTruthy();
  });

  test("deve manter o hábito após atualizar a página", async ({ page }) => {
    await page.goto("/rotina/habitos");

    await page.getByRole("button", { name: /Novo hábito/ }).click();
    await expect(page.locator("#habit-form")).toBeVisible();

    await page.locator("#habit-name").fill("Hábito persistente");

    await page.getByRole("button", { name: "Cadastrar hábito" }).click();
    await expect(page.getByText("Hábito persistente")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Hábito persistente")).toBeVisible();
  });
});

test.describe("Financeiro - Pagamentos e recebimentos parciais", () => {
  test("deve calcular corretamente o saldo restante de uma despesa parcialmente paga", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_transactions", JSON.stringify([{
        id: 92001,
        type: "Despesa",
        description: "Despesa parcialmente paga",
        amount: 1000,
        settledAmount: 400,
        date: "2026-12-20",
        category: "Moradia",
        status: "Paga parcialmente"
      }]));
    });

    await page.goto("/financeiro/contas-a-pagar");

    await expect(page.getByText("R$ 600,00").first()).toBeVisible();
    await expect(page.getByText(/Pago:.*R\$ 400,00.*Pendente:.*R\$ 600,00/)).toBeVisible();
    await expect(page.getByText("Paga parcialmente")).toBeVisible();
  });

  test("deve calcular corretamente o saldo restante de uma receita parcialmente recebida", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("nexo_transactions", JSON.stringify([{
        id: 92002,
        type: "Receita",
        description: "Receita parcialmente recebida",
        amount: 1000,
        settledAmount: 400,
        date: "2026-12-20",
        category: "Serviços",
        status: "Recebida parcialmente"
      }]));
    });

    await page.goto("/financeiro/contas-a-receber");

    await expect(page.getByText("R$ 600,00").first()).toBeVisible();
    await expect(page.getByText(/Recebido:.*R\$ 400,00.*Pendente:.*R\$ 600,00/)).toBeVisible();
    await expect(page.getByText("Recebida parcialmente")).toBeVisible();
  });
});

test.describe("Financeiro - Proteção de dados", () => {
  test("deve carregar a página financeira sem erro de JavaScript", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/financeiro");
    await expect(page.locator("h1, h2").first()).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("deve preservar os lançamentos válidos existentes", async ({ page }) => {
    const testTransaction = {
      id: 999001,
      type: "Receita",
      description: "Lançamento de teste",
      amount: 100,
      date: "2026-11-16",
      category: "Salário",
      status: "Recebida"
    };

    await page.addInitScript((transaction) => {
      localStorage.setItem("nexo_transactions", JSON.stringify([transaction]));
    }, testTransaction);

    await page.goto("/financeiro");

    await expect(page.getByText("Lançamento de teste")).toBeVisible();

    await expect.poll(
      () =>
        page.evaluate(() => {
          const saved = JSON.parse(
            localStorage.getItem("nexo_transactions") || "[]"
          );

          return (
            Array.isArray(saved) &&
            saved.some((item: { id: number }) => item.id === 999001)
          );
        }),
      {
        message: "O lançamento válido deve permanecer no LocalStorage após o carregamento."
      }
    ).toBe(true);
  });
});
