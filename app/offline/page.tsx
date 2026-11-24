export const metadata = {
  title: "Sem conexão | NEXO",
  description: "O NEXO precisa de conexão para acessar seus dados com segurança."
};

export default function OfflinePage() {
  return (
    <main className="nexo-offline-page">
      <section className="nexo-offline-card">
        <div className="nexo-offline-mark" aria-hidden="true">N</div>
        <p className="nexo-offline-eyebrow">NEXO / CONEXÃO</p>
        <h1>Você está sem conexão</h1>
        <p>Por segurança, o NEXO não mantém informações financeiras ou pessoais disponíveis offline.</p>
        <p>Conecte-se à internet e tente novamente. Seus dados continuam protegidos na sua conta.</p>
        <a href="/">Tentar novamente</a>
      </section>
    </main>
  );
}
