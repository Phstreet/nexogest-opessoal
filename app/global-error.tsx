"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import styles from "./global-error.module.css";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className={styles.body}>
        <main className={styles.panel} role="alert">
          <p className={styles.eyebrow}>NEXO · SISTEMA</p>
          <h1>Falha ao iniciar o NEXO</h1>
          <p className={styles.description}>
            Ocorreu um erro ao carregar a estrutura principal. Tente novamente.
          </p>
          {error.digest ? <p className={styles.digest}>Código: {error.digest}</p> : null}
          <button type="button" className={styles.button} onClick={reset}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
