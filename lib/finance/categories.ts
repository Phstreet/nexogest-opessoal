
export type CategoryGroup = {
    name: string;
    subcategories: string[];
  };
  
  export const INCOME_CATEGORIES: CategoryGroup[] = [
    {
      name: "Salário",
      subcategories: ["Salário mensal", "Adiantamento", "Hora extra", "Comissão", "Bônus"],
    },
    {
      name: "Renda extra",
      subcategories: ["Freelance", "Serviços", "Vendas", "Comissões"],
    },
    {
      name: "Investimentos",
      subcategories: ["Juros", "Dividendos", "Rendimentos", "Resgates"],
    },
    {
      name: "Outras receitas",
      subcategories: ["Reembolso", "Presente", "Outros"],
    },
  ];
  
  export const EXPENSE_CATEGORIES: CategoryGroup[] = [
    {
      name: "Moradia",
      subcategories: ["Aluguel", "Condomínio", "Água", "Energia", "Internet", "Manutenção"],
    },
    {
      name: "Alimentação",
      subcategories: ["Mercado", "Restaurante", "Lanches", "Delivery"],
    },
    {
      name: "Transporte",
      subcategories: ["Combustível", "Transporte público", "Aplicativos", "Manutenção", "Estacionamento"],
    },
    {
      name: "Saúde",
      subcategories: ["Plano de saúde", "Medicamentos", "Consultas", "Exames"],
    },
    {
      name: "Educação",
      subcategories: ["Cursos", "Mensalidades", "Livros", "Materiais"],
    },
    {
      name: "Lazer",
      subcategories: ["Passeios", "Viagens", "Streaming", "Eventos"],
    },
    {
      name: "Compras",
      subcategories: ["Roupas", "Eletrônicos", "Casa", "Cuidados pessoais"],
    },
    {
      name: "Financeiro",
      subcategories: ["Cartão de crédito", "Empréstimos", "Juros", "Tarifas", "Impostos"],
    },
    {
      name: "Outros",
      subcategories: ["Doações", "Presentes", "Despesas diversas"],
    },
  ];
  
  export const INVESTMENT_CATEGORIES: CategoryGroup[] = [
    {
      name: "Renda fixa",
      subcategories: ["CDB", "LCI", "LCA", "Tesouro Direto", "Debêntures"],
    },
    {
      name: "Renda variável",
      subcategories: ["Ações", "FIIs", "ETFs", "BDRs"],
    },
    {
      name: "Fundos",
      subcategories: ["Fundos de investimento", "Fundos multimercado"],
    },
    {
      name: "Outros investimentos",
      subcategories: ["Previdência", "Criptomoedas", "Outros"],
    },
  ];
  
  export const RESERVE_CATEGORIES = [
    "Emergência",
    "Objetivo pessoal",
    "Moradia",
    "Viagem",
    "Investimentos",
    "Outros",
  ] as const;
  
  export function getSubcategories(
    category: string,
    group: "income" | "expense" | "investment"
  ): string[] {
    const source =
      group === "income"
        ? INCOME_CATEGORIES
        : group === "expense"
          ? EXPENSE_CATEGORIES
          : INVESTMENT_CATEGORIES;
  
    return (
      source.find((item) => item.name === category)?.subcategories ?? []
    );
  }
  
  export function getCategoryNames(
    group: "income" | "expense" | "investment"
  ): string[] {
    const source =
      group === "income"
        ? INCOME_CATEGORIES
        : group === "expense"
          ? EXPENSE_CATEGORIES
          : INVESTMENT_CATEGORIES;
  
    return source.map((item) => item.name);
  }
  