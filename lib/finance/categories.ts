
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
  

// Categorias oficiais utilizadas no cadastro de lançamentos do Financeiro,
// Contas a pagar e Contas a receber.
export const categoriesByType: Record<"Receita" | "Despesa" | "Transferência" | "Investimento", string[]> = {
  Receita: [
    "Salário", "13º Salário", "Adiantamento Salarial", "Horas Extras",
    "Comissões", "Trabalhos Extras", "Reembolsos", "Receitas Eventuais",
    "Rendimentos", "Outros",
  ],
  Despesa: [
    "Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer",
    "Serviços", "Assinaturas", "Religião", "Impostos", "Dívidas", "Outros",
  ],
  Transferência: ["Transferência"],
  Investimento: ["Investimento"],
};

export const subcategories: Record<string, string[]> = {
  Salário: ["Salário mensal", "Adiantamento", "Outros"],
  "13º Salário": ["Primeira parcela", "Segunda parcela", "Integral", "Outros"],
  "Adiantamento Salarial": ["Adiantamento", "Outros"],
  "Horas Extras": ["Horas extras", "DSR", "Outros"],
  Comissões: ["Comissão", "Outros"],
  "Trabalhos Extras": ["Serviços extras", "Freelance", "Outros"],
  Reembolsos: ["Reembolso de despesas", "Outros"],
  "Receitas Eventuais": ["Venda", "Presente", "Outros"],
  Rendimentos: ["Rendimento de conta", "Rendimento financeiro", "Outros"],
  Moradia: ["Aluguel", "Condomínio", "Energia", "Água", "Internet", "Gás", "Manutenção", "Móveis", "Casa", "Outros"],
  Alimentação: ["Mercado", "Restaurante", "iFood", "Keeta", "99 Food", "Lanches", "Outros"],
  Transporte: ["Combustível", "Transporte público", "Aplicativos", "Estacionamento", "Manutenção do veículo", "Carro", "Outros"],
  Saúde: ["Plano de saúde", "Consulta", "Exames", "Medicamentos", "Odontologia", "Outros"],
  Educação: ["Cursos", "Material escolar", "Livros", "Notebook", "Outros"],
  Lazer: ["Viagem", "Cinema", "Passeios", "Eventos", "Televisão", "Outros"],
  Serviços: ["Telefonia", "Internet", "Manutenção", "Serviços domésticos", "Outros"],
  Assinaturas: ["Streaming", "Telefonia", "Aplicativos", "Outros"],
  Religião: ["Dízimo", "Oferta", "Doação", "Caixinha", "Outros"],
  Impostos: ["IPVA", "IPTU", "Imposto de renda", "Multas", "Outros"],
  Dívidas: ["Empréstimo", "Cartão de crédito", "Financiamento", "Parcelamento", "Outros"],
  Outros: ["Notebook", "Televisão", "Carro", "Casa", "Viagem", "Outros"],
  Transferência: ["Entre contas"],
};
