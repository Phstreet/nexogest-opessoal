import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "@/lib/observability/sentry-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  enableLogs: false,
  beforeSend(event) {
    return scrubSentryEvent(event);
  },
});
