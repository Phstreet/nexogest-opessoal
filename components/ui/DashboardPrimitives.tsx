"use client";

import Link from "next/link";
import type { ReactNode } from "react";


type PageShellProps = {
  children: ReactNode;
};

export function PageShell({ children }: PageShellProps) {
  return <div className="nexo-page-shell">{children}</div>;
}

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, breadcrumb, actions, className = "" }: PageHeaderProps) {
  return (
    <header className={`nexo-page-header ${className}`.trim()}>
      <div className="nexo-page-header-copy">
        {breadcrumb && <nav className="nexo-page-breadcrumb" aria-label="Caminho da página">{breadcrumb}</nav>}
        {eyebrow && <span className="nexo-page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p className="nexo-empty-description">{description}</p>}
      </div>
      {actions && <div className="nexo-page-header-actions">{actions}</div>}
    </header>
  );
}

type CardProps = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return <section className={`nexo-card ${className}`.trim()}>{children}</section>;
}

type CardHeaderProps = {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
};

export function CardHeader({ icon, title, action }: CardHeaderProps) {
  return (
    <header className="nexo-card-header">
      <h2 title={title}><span className="nexo-card-header-title">{icon && <span className="nexo-card-header-icon">{icon}</span>}{title}</span></h2>
      {action && <div className="nexo-card-header-action">{action}</div>}
    </header>
  );
}

export function CardBody({ children, className = "" }: CardProps) {
  return <div className={`nexo-card-body ${className}`.trim()}>{children}</div>;
}

type StatCardProps = {
  href: string;
  icon: ReactNode;
  value: ReactNode;
  label: string;
  className?: string;
};

export function StatCard({ href, icon, value, label, className = "" }: StatCardProps) {
  return (
    <Link href={href} className={`nexo-stat-card ${className}`.trim()}>
      <span className="nexo-stat-icon">{icon}</span>
      <span className="nexo-stat-copy">
        <strong className="nexo-stat-value">{value}</strong>
        <small>{label}</small>
      </span>
      <span className="nexo-stat-arrow" aria-hidden="true">↗</span>
    </Link>
  );
}

type QuickActionProps = {
  href: string;
  icon: ReactNode;
  label: string;
};

export function QuickAction({ href, icon, label }: QuickActionProps) {
  return (
    <Link href={href} className="nexo-quick-action">
      <span className="nexo-quick-action-icon">{icon}</span>
      <span className="nexo-quick-action-label">{label}</span>
    </Link>
  );
}

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

export function EmptyState({ icon, title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <div className="nexo-empty-state">
      <span className="nexo-empty-icon">{icon}</span>
      <strong className="nexo-empty-title">{title}</strong>
      <p>{description}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="nexo-empty-action">{actionLabel}</Link>
      )}
    </div>
  );
}

export function SearchButton() {
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    const platform = navigator.platform || "";
    if (/Mac|iPhone|iPad|iPod/i.test(platform)) {
      setShortcut("⌘K");
    }
  }, []);

  return (
    <button
      type="button"
      className="nexo-search-button"
      onClick={() => window.dispatchEvent(new Event("nexo:open-search"))}
      aria-label="Buscar"
    >
      <Search size={14} aria-hidden="true" />
      <span className="nexo-search-label">Buscar</span>
      <kbd>{shortcut}</kbd>
    </button>
  );
}
