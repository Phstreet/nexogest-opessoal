type SentryEventLike = {
  user?: unknown;
  request?: Record<string, unknown>;
  message?: string;
  transaction?: string;
  culprit?: string;
  logentry?: { message?: string; params?: unknown[] };
  exception?: { values?: Array<{ type?: string; value?: string; stacktrace?: unknown }> };
  breadcrumbs?: Array<{ timestamp?: number; category?: string; type?: string; level?: string; [key: string]: unknown }>;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  fingerprint?: string[];
  [key: string]: unknown;
};

const SAFE_TAGS = new Set(["environment", "release", "runtime", "route", "test_event", "source"]);

/**
 * Política conservadora para telemetria financeira:
 * remove identidade, corpo/cabeçalhos/query, dados livres e valores de breadcrumbs.
 * Mensagens e valores de exceções são substituídos para não transmitir nomes de contas.
 */
export function scrubSentryEvent<T>(event: T): T {
  const clean = { ...(event as unknown as SentryEventLike) };
  delete clean.user;
  delete clean.extra;
  delete clean.contexts;
  delete clean.fingerprint;
  delete clean.transaction;
  delete clean.culprit;

  clean.request = clean.request
    ? { method: clean.request.method }
    : undefined;

  clean.message = clean.message ? "[mensagem removida por privacidade]" : undefined;
  clean.logentry = clean.logentry
    ? { message: "[mensagem removida por privacidade]" }
    : undefined;

  if (clean.exception?.values) {
    clean.exception = {
      ...clean.exception,
      values: clean.exception.values.map((item) => ({
        type: item.type,
        value: "[detalhe removido por privacidade]",
        stacktrace: item.stacktrace,
      })),
    };
  }

  clean.breadcrumbs = clean.breadcrumbs?.map((crumb) => ({
    timestamp: crumb.timestamp,
    category: crumb.category,
    type: crumb.type,
    level: crumb.level,
  }));

  if (clean.tags) {
    clean.tags = Object.fromEntries(
      Object.entries(clean.tags).filter(([key]) => SAFE_TAGS.has(key))
    );
  }
  return clean as unknown as T;
}
