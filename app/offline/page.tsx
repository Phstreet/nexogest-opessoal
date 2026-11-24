import Link from "next/link";

export const metadata = {
  title: "Sem conexão | NEXO",
  description: "O NEXO está aguardando uma conexão segura para carregar seus dados.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="nexo-offline-page">
      <section className="nexo-offline-card" aria-labelledby="offline-title">
        <div className="nexo-offline-mark" aria-hidden="true">N</div>
        <span className="nexo-offline-eyebrow">NEXO / MODO SEGURO</span>
        <h1 id="offline-title">Você está sem conexão.</h1>
        <p>
          Seus dados financeiros e pessoais não são armazenados para uso offline.
          Quando a internet voltar, tente novamente para continuar com segurança.
        </p>
        <div className="nexo-offline-status"><span aria-hidden="true" /> Conteúdo privado protegido</div>
        <Link href="/offline" className="nexo-offline-retry">Tentar novamente</Link>
        <Link href="/" className="nexo-offline-link">Voltar ao NEXO</Link>
      </section>
    </main>
  );
}
