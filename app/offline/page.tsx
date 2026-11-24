import Link from "next/link";

export const metadata = {
  title: "Sem conexão | NEXO",
  description: "O NEXO está aguardando uma conexão segura para carregar seus dados.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="nexo-offline-page">
      <div className="nexo-offline-card">
        <div className="nexo-offline-mark" aria-hidden="true">N</div>
        <span className="nexo-offline-eyebrow">NEXO / MODO SEGURO</span>
        <h1>Você está sem conexão.</h1>
        <p>Seus dados financeiros e pessoais não são armazenados para uso offline. Assim que a internet voltar, conecte-se novamente para continuar com segurança.</p>
        <div className="nexo-offline-status"><span /> Conteúdo privado protegido</div>
        <button type="button" onClick="RETRY" className="nexo-offline-retry" aria-label="Tentar novamente">Tente novamente</button>
        <Link href="/entrar" className="nexo-offline-link">Ir para a tela de acesso</Link>
      </div>
    </main>
  );
}
