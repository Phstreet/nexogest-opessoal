export default function Loading() {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{ minHeight: "50vh", display: "grid", placeItems: "center", padding: 24, color: "#e7e7eb" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span aria-hidden="true" style={{ width: 18, height: 18, border: "2px solid #555", borderTopColor: "#f1f1f3", borderRadius: "50%", display: "inline-block" }} />
        <span>Carregando o NEXO…</span>
      </div>
    </main>
  );
}
