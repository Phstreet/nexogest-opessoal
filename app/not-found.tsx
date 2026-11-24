import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", padding: 24, background: "#0b0b0e", color: "#f1f1f3" }}>
      <section style={{ width: "min(100%, 520px)", padding: 28, border: "1px solid #303039", borderRadius: 18, background: "#15151a", textAlign: "center" }}>
        <p style={{ margin: 0, color: "#a5a5af", fontSize: 11, letterSpacing: 1.5 }}>NEXO · 404</p>
        <h1 style={{ margin: "10px 0", fontSize: 28 }}>Página não encontrada</h1>
        <p style={{ color: "#b8b8c1", lineHeight: 1.6 }}>O endereço pode ter sido alterado ou não existe.</p>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", minHeight: 42, marginTop: 12, padding: "0 16px", borderRadius: 10, background: "#e8e8eb", color: "#141418", fontWeight: 650, textDecoration: "none" }}>Voltar à Central do Dia</Link>
      </section>
    </main>
  );
}
