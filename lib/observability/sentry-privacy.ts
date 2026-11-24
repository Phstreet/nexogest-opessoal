type SentryEventLike = {
  user?: unknown;
  request?: Record<string, unknown>;
  message?: string;
  logentry?: { message?: string; params?: unknown[] };
  exception?: { values?: Array<{ value?: string; mechanism?: unknown }> };
  breadcrumbs?: Array<{ message?: string; data?: Record<string, unknown>; [key: string]: unknown }>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  [key: string]: unknown;
};

const SENSITIVE_KEY =
  /(amount|balance|money|currency|account|bank|email|token|authorization|cookie|password|body|payload|transaction|salary|income|expense|valor|saldo|conta|banco|receita|despesa|senha|e-?mail)/i;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MONEY = /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|R\$\s*\d+(?:[.,]\d{2})?/gi;
const BEARER = /Bearer\s+[A-Z0-9._~+/-]+=*/gi;
const JWT = /\beyJ[A-Z0-9_-]{10,}\.[A-Z0-9_-]{10,}\.[A-Z0-9_-]{10,}\b/gi;

function redactText(value: string): string {
  return value
    .replace(EMAIL, "[e-mail removido]")
    .replace(MONEY, "[valor removido]")
    .replace(BEARER, "Bearer [token removido]")
    .replace(JWT, "[token removido]");
}

function scrubObject(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) return value;
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrubObject(item, depth + 1));
  if (typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) continue;
    result[key] = scrubObject(item, depth + 1);
  }
  return result;
}

/**
 * Redação conservadora: remove request bodies/headers/query, identidade do usuário,
 * extras e breadcrumbs livres. Mensagens de exceção são substituídas para não
 * transmitir nomes de contas ou dados financeiros inseridos em mensagens.
 */
export function scrubSentryEvent(event: SentryEventLike): SentryEventLike {
  const clean = { ...event };
  delete clean.user;
  delete clean.extra;
  delete clean.contexts;
  clean.request = clean.request
    ? {
        method: clean.request.method,
        url: typeof clean.request.url === "string"
          ? clean.request.url.split("?")[0]
          : undefined,
      }
    : undefined;
  clean.message = clean.message ? "[mensagem removida por privacidade]" : undefined;
  clean.logentry = clean.logentry
    ? { message: "[mensagem removida por privacidade]" }
    : undefined;
  if (clean.exception?.values) {
    clean.exception = {
      ...clean.exception,
      values: clean.exception.values.map((item) => ({
        ...item,
        value: "[detalhe removido por privacidade]",
      })),
    };
  }
  clean.breadcrumbs = clean.breadcrumbs?.map((crumb) => ({
    timestamp: crumb.timestamp,
    category: crumb.category,
    type: crumb.type,
    level: crumb.level,
    message: undefined,
    data: scrubObject(crumb.data) as Record<string, unknown> | undefined,
  }));
  return clean;
}
