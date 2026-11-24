"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallPromptProps = { mode?: "banner" | "settings" };
const DISMISSED_KEY = "nexo_pwa_install_dismissed";

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export default function InstallPrompt({ mode = "banner" }: InstallPromptProps) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(isIOS);
    setAndroid(/Android/i.test(ua));
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    setOffline(!navigator.onLine);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      setDismissed(true);
    };
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    const onControllerChange = () => window.location.reload();

    if (mode === "banner" && "serviceWorker" in navigator && process.env.NODE_ENV === "production" && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((value) => {
          if (disposed) return;
          registration = value;
          if (value.waiting && navigator.serviceWorker.controller) setUpdateReady(true);
          value.addEventListener("updatefound", () => {
            const worker = value.installing;
            worker?.addEventListener("statechange", () => {
              if (!disposed && worker.state === "installed" && navigator.serviceWorker.controller) {
                setUpdateReady(true);
              }
            });
          });
          void value.update().catch(() => undefined);
        })
        .catch(() => undefined);
      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    }

    return () => {
      disposed = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      }
      void registration;
    };
  }, [mode]);

  async function install() {
    if (!installEvent) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallEvent(null);
    } catch {
      setInstallEvent(null);
    } finally {
      setInstalling(false);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // O aviso continua dispensado durante esta sessão mesmo sem armazenamento local.
    }
    setDismissed(true);
  }

  function updateNow() {
    void navigator.serviceWorker?.getRegistration().then((registration) => {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
  }

  const canOfferInstall = !installed && !dismissed && (Boolean(installEvent) || ios || android);

  if (mode === "banner") {
    return (
      <>
        {offline && (
          <div className="nexo-connection-status" role="status" aria-live="polite">
            <span aria-hidden="true" /> Você está offline. Seus dados pessoais permanecem protegidos.
          </div>
        )}
        {updateReady && (
          <div className="nexo-update-banner" role="status">
            <span>Nova versão disponível.</span>
            <button type="button" onClick={updateNow}>Nova versão disponível — atualizar</button>
          </div>
        )}
        {canOfferInstall && (installEvent || ios) && (
          <aside className="nexo-install-banner" aria-label="Instalar aplicativo NEXO">
            <div><strong>Leve o NEXO com você</strong><span>Instale para abrir em tela cheia.</span></div>
            {installEvent
              ? <button type="button" onClick={() => void install()} disabled={installing}>{installing ? "Abrindo..." : "Instalar aplicativo"}</button>
              : <a href="/configuracoes?tab=aplicativo">Como instalar</a>}
            <button className="nexo-install-dismiss" type="button" onClick={dismiss} aria-label="Dispensar aviso">×</button>
          </aside>
        )}
      </>
    );
  }

  return (
    <section className="nexo-pwa-settings" aria-labelledby="nexo-pwa-title">
      <div className="nexo-pwa-heading">
        <div className="nexo-pwa-icon" aria-hidden="true">N</div>
        <div><h3 id="nexo-pwa-title">Instalar o NEXO no celular</h3><p>Use o NEXO como aplicativo, com ícone próprio e abertura em tela cheia.</p></div>
      </div>
      {installed ? (
        <p className="nexo-pwa-success" role="status">O NEXO já está instalado neste dispositivo.</p>
      ) : (
        <>
          {installEvent && <button type="button" className="nexo-pwa-primary" onClick={() => void install()} disabled={installing}>{installing ? "Preparando instalação..." : "Instalar aplicativo"}</button>}
          {ios && (
            <div className="nexo-pwa-instructions">
              <h4>iPhone e iPad (Safari)</h4>
              <ol>
                <li><span aria-hidden="true">↥</span><div><strong>Toque em Compartilhar</strong><small>Use o ícone de compartilhar na barra do Safari.</small></div></li>
                <li><span aria-hidden="true">＋</span><div><strong>Adicionar à Tela de Início</strong><small>Role o menu e escolha essa opção.</small></div></li>
                <li><span aria-hidden="true">N</span><div><strong>Confirme em Adicionar</strong><small>O ícone NEXO aparecerá na tela inicial.</small></div></li>
              </ol>
              <p>Faça a instalação pelo Safari. Em navegadores alternativos, o fluxo pode variar conforme a versão do iOS.</p>
            </div>
          )}
          {android && !installEvent && (
            <div className="nexo-pwa-instructions">
              <h4>Android (Chrome)</h4>
              <ol>
                <li><span aria-hidden="true">⋮</span><div><strong>Abra o menu do Chrome</strong><small>Toque nos três pontos no canto superior.</small></div></li>
                <li><span aria-hidden="true">＋</span><div><strong>Instalar app ou Adicionar à tela inicial</strong><small>O texto varia conforme o aparelho e a versão do Chrome.</small></div></li>
                <li><span aria-hidden="true">N</span><div><strong>Confirme a instalação</strong><small>O NEXO será adicionado aos aplicativos.</small></div></li>
              </ol>
            </div>
          )}
          {!ios && !android && !installEvent && (
            <p>Abra esta tela no navegador do celular para ver as instruções de instalação.</p>
          )}
        </>
      )}
      <p className="nexo-pwa-privacy">Privacidade offline: páginas autenticadas, dados financeiros e respostas do Supabase nunca são armazenados pelo service worker.</p>
      {updateReady && <button type="button" className="nexo-pwa-secondary" onClick={updateNow}>Nova versão disponível — atualizar</button>}
      {canOfferInstall && <button type="button" className="nexo-pwa-dismiss" onClick={dismiss}>Não mostrar o aviso de instalação</button>}
    </section>
  );
}
