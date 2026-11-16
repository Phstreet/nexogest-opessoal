
export type MenuItem = {
    label: string;
    href: string;
    icon?: string;
  };
  
  export const financeMenuItems: MenuItem[] = [
    { label: "Visão geral financeira", href: "/financeiro", icon: "◈" },
    { label: "Contas", href: "/financeiro/contas", icon: "▤" },
    { label: "Contas a pagar", href: "/financeiro/contas-a-pagar", icon: "↗" },
    { label: "Contas a receber", href: "/financeiro/contas-a-receber", icon: "↙" },
    { label: "Histórico financeiro", href: "/financeiro/historico", icon: "◷" },
    { label: "Investimentos", href: "/financeiro/investimentos", icon: "◉" },
    { label: "Reserva financeira", href: "/financeiro/reservas", icon: "◇" },
    { label: "Planejamento", href: "/financeiro/planejamento", icon: "▦" },
    { label: "Dashboard financeiro", href: "/financeiro/dashboard", icon: "▥" },
  ];
  
  export const routineMenuItems: MenuItem[] = [
    { label: "Visão geral da rotina", href: "/rotina", icon: "⌂" },
    { label: "Agenda diária", href: "/rotina/agenda", icon: "▦" },
    { label: "Tarefas", href: "/rotina/tarefas", icon: "☑" },
    { label: "Planejamento semanal", href: "/rotina/planejamento", icon: "▤" },
    { label: "Hábitos", href: "/rotina/habitos", icon: "↻" },
    { label: "Produtividade", href: "/rotina/produtividade", icon: "◷" },
  ];
  
  export const mainMenuItems: MenuItem[] = [
    { label: "Visão geral", href: "/", icon: "⌂" },
    ...financeMenuItems,
    ...routineMenuItems,
  ];
  