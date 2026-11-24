"use client";

import { usePwa } from "@/components/pwa/PwaProvider";

export default function PwaInstallSettings() {
  const { isOnline, isInstalled, isIos, canInstall, install } = usePwa();

  return (
    <section className="nexo-pwa-settings">
      <div className="nexo-pwa-settings-heading">
        <span className="nexo-pwa-symbol" aria-hidden="true">N</span>
        <div>
          <h2>Instalar o NEXO no celular</h2>
          <p>Adicione o NEXO à tela inicial para abrir em uma janela própria, sem a barra do navegador.</p>
        </div>
      </div>

      {isInstalled ? (
        <p className="nexo-pwa-installed" role="status">O NEXO já está instalado neste dispositivo.</p>
      ) : isIos ? (
        <div className="nexo-pwa-instructions">
          <h3>iPhone ou iPad — Safari</h3>
          <ol>
            <li><span className="nexo-pwa-step-icon" aria-hidden="true">↥</span><span>Abra o NEXO no <strong>Safari</strong> e toque em <strong>Compartilhar</strong> na barra do navegador.</span></li>
            <li><span className="nexo-pwa-step-icon" aria-hidden="true">＋</span><span>Role o menu e escolha <strong>Adicionar à Tela de Início</strong>.</span></li>
            <li><span className="nexo-pwa-step-icon" aria-hidden="true">N</span><span>Confirme o nome <strong>NEXO</strong> e toque em <strong>Adicionar</strong>.</span></li>
          </ol>
          <p className="nexo-pwa-note">No iPhone, a instalação é feita pelo menu Compartilhar do Safari. Outros navegadores podem encaminhar a página ao Safari.</p>
        </div>
      ) : (
        <div className="nexo-pwa-instructions">
          <h3>Android — Chrome</h3>
          <ol>
            <li><span className="nexo-pwa-step-icon" aria-hidden="true">⋮</span><span>Abra o NEXO no <strong>Google Chrome</strong>.</span></li>
            <li><span className="nexo-pwa-step-icon" aria-hidden="true">↓</span><span>Toque em <strong>Instalar aplicativo</strong> ou em <strong>Adicionar à tela inicial</strong> no menu.</span></li>
            <li><span className="nexo-pwa-step-icon" aria-hidden="true">N</span><span>Confirme a instalação. O ícone <strong>NEXO</strong> aparecerá na tela inicial.</span></li>
          </ol>
          {canInstall && <button type="button" className="nexo-pwa-install-button" onClick={() => void install()}>Instalar aplicativo</button>}
          {!canInstall && <p className="nexo-pwa-note">Se o botão não aparecer, atualize a página no Chrome e verifique se o endereço está em HTTPS.</p>}
        </div>
      )}

      <div className="nexo-pwa-security-note">
        <strong>Privacidade offline</strong>
        <p>{isOnline ? "Conectado. O NEXO armazena apenas recursos estáticos públicos para acelerar a abertura." : "Sem conexão. O acesso a dados financeiros e pessoais fica indisponível até a internet voltar."} Nenhuma página autenticada ou resposta do Supabase é armazenada pelo service worker.</p>
      </div>
    </section>
  );
}
