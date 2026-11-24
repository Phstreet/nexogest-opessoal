"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import styles from "./global-error.module.css";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main role="alert" className={styles.body}>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>NEXO · SISTEMA</p>
        <h1 className={styles.heading}>Não foi possível carregar esta tela</h1>
        <p className={styles.description}>
          Ocorreu um erro inesperado. Seus dados salvos na nuvem não são apagados por esta falha. Tente novamente.
        </p>
        <button type="button" onClick={reset} className={styles.button}>
          Tentar novamente
        </button>
        {error.digest ? (
          <p className={styles.digest}>Código de referência: {error.digest}</p>
        ) : null}
      </section>
    </main>
  );
}
