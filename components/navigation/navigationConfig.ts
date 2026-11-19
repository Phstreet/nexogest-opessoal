export type MenuItem = {
  label: string;
  href: string;
  icon?: string;
};

export type MenuSection = {
  label: string;
  href: string;
  icon: string;
  items: MenuItem[];
};

export const financeMenuItems: MenuItem[] = [
  { label: "Visão geral financeira", href: "/financeiro", icon: "◈" },
  { label: "Contas", href: "/financeiro/contas", icon: "▤" },
  { label: "Contas a pagar", href: "/financeiro/contas-a-pagar", icon: "↗" },
  { label: "Contas a receber", href: "/financeiro/contas-a-receber", icon: "↙" },
  { label: "Histórico", href: "/financeiro/historico", icon: "◷" },
  { label: "Investimentos", href: "/financeiro/investimentos", icon: "◉" },
  { label: "Reservas", href: "/financeiro/reservas", icon: "◇" },
  { label: "Planejamento", href: "/financeiro/planejamento", icon: "▦" },
  { label: "Dashboard financeiro", href: "/financeiro/dashboard", icon: "▥" },
];

export const routineMenuItems: MenuItem[] = [
  { label: "Agenda diária", href: "/rotina/agenda", icon: "▦" },
  { label: "Tarefas", href: "/rotina/tarefas", icon: "☑" },
  { label: "Hábitos", href: "/rotina/habitos", icon: "↻" },
  { label: "Planejamento semanal", href: "/rotina/planejamento", icon: "▤" },
  { label: "Produtividade", href: "/rotina/produtividade", icon: "◷" },
];

export const reportsMenuItems: MenuItem[] = [
  { label: "Visão geral de relatórios", href: "/relatorios", icon: "▥" },
  { label: "Desempenho semanal", href: "/rotina/produtividade", icon: "◷" },
  { label: "Evolução financeira", href: "/financeiro/dashboard", icon: "▥" },
  { label: "Evolução dos hábitos", href: "/rotina/habitos", icon: "↻" },
  { label: "Histórico de resultados", href: "/financeiro/historico", icon: "▤" },
];

export const settingsMenuItems: MenuItem[] = [
  { label: "Preferências", href: "/configuracoes?tab=preferencias", icon: "⚙" },
  { label: "Categorias", href: "/configuracoes?tab=categorias", icon: "▦" },
  { label: "Dados e backups", href: "/configuracoes?tab=dados", icon: "◫" },
  { label: "Personalização", href: "/configuracoes?tab=personalizacao", icon: "◐" },\n  { label: "Segurança", href: "/configuracoes?tab=seguranca", icon: "⌑" },
];

export const mainMenuItems: MenuItem[] = [
  { label: "Central do Dia", href: "/", icon: "⌂" },
  ...financeMenuItems,
  ...routineMenuItems,
  ...reportsMenuItems,
  ...settingsMenuItems,
];

export const menuSections: MenuSection[] = [
  { label: "Financeiro", href: "/financeiro", icon: "◈", items: financeMenuItems },
  { label: "Rotina", href: "/rotina", icon: "▤", items: routineMenuItems },
  { label: "Relatórios", href: "/relatorios", icon: "▥", items: reportsMenuItems },
  { label: "Configurações", href: "/configuracoes", icon: "⚙", items: settingsMenuItems },
];
