import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/sentry-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
  enableLogs: false,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === "console" || breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
      return null;
    }
    return { ...breadcrumb, message: undefined, data: undefined };
  },
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "NetworkError when attempting to fetch resource",
    "Failed to fetch",
    "Load failed",
    "The operation was aborted",
    "Script error.",
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
  ],
});
