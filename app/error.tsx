"use client";

import { useEffect } from "react";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Erro não tratado na interface do NEXO:", error);
  }, [error]);

  return (
    <main role="alert" style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, background: "#0b0b0e", color: "#f1f1f3" }}>
      <section style={{ width: "min(100%, 520px)", padding: 28, border: "1px solid #303039", borderRadius: 18, background: "#15151a", boxShadow: "0 18px 48px rgba(0,0,0,.3)" }}>
        <p style={{ margin: "0 0 8px", color: "#a5a5af", fontSize: 11, letterSpacing: 1.5 }}>NEXO · SISTEMA</p>
        <h1 style={{ margin: "0 0 10px", fontSize: 24 }}>Não foi possível carregar esta tela</h1>
        <p style={{ margin: "0 0 22px", color: "#b8b8c1", lineHeight: 1.6 }}>Ocorreu um erro inesperado. Seus dados salvos na nuvem não são apagados por esta falha. Tente novamente.</p>
        <button type="button" onClick={reset} style={{ minHeight: 42, padding: "0 16px", border: "1px solid #666", borderRadius: 10, background: "#e8e8eb", color: "#141418", fontWeight: 650, cursor: "pointer" }}>Tentar novamente</button>
        {error.digest ? <p style={{ margin: "16px 0 0", color: "#85858f", fontSize: 11 }}>Código de referência: {error.digest}</p> : null}
      </section>
    </main>
  );
}
