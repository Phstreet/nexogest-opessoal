"use client";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#0b0b0e", color: "#f1f1f3", fontFamily: "Arial, sans-serif" }}>
        <main role="alert" style={{ width: "min(100%, 520px)", padding: 28, border: "1px solid #303039", borderRadius: 18, background: "#15151a" }}>
          <p style={{ color: "#a5a5af", fontSize: 11, letterSpacing: 1.5 }}>NEXO · SISTEMA</p>
          <h1>Falha ao iniciar o NEXO</h1>
          <p style={{ color: "#b8b8c1", lineHeight: 1.6 }}>Ocorreu um erro ao carregar a estrutura principal. Tente novamente.</p>
          {error.digest ? <p style={{ color: "#85858f", fontSize: 11 }}>Código: {error.digest}</p> : null}
          <button type="button" onClick={reset} style={{ minHeight: 42, padding: "0 16px", border: "1px solid #666", borderRadius: 10, background: "#e8e8eb", color: "#141418", fontWeight: 650, cursor: "pointer" }}>Tentar novamente</button>
          {error.digest ? <p style={{ color: "#85858f", fontSize: 11 }}>Código: {error.digest}</p> : null}
        </main>
      </body>
    </html>
  );
}
