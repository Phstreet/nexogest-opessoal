"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaContextValue = {
  isOnline: boolean;
  isInstalled: boolean;
  isIos: boolean;
  canInstall: boolean;
  updateAvailable: boolean;
  install: () => Promise<void>;
  updateNow: () => void;
  dismissInstallBanner: () => void;
};

const PwaContext = createContext<PwaContextValue | null>(null);
const DISMISSED_KEY = "nexo_pwa_install_dismissed_v1";

export function usePwa() {
  const value = useContext(PwaContext);
  if (!value) throw new Error("usePwa deve ser utilizado dentro de PwaProvider.");
  return value;
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const deferredPrompt = useRef<InstallPromptEvent | null>(null);
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const reloadAfterUpdate = useRef(false);

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine);
    const checkInstalled = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setIsInstalled(standalone);
    };

    updateConnection();
    checkInstalled();
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setBannerDismissed(localStorage.getItem(DISMISSED_KEY) === "1");

    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", checkInstalled);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferredPrompt.current = event as InstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      deferredPrompt.current = null;
      setCanInstall(false);
      setIsInstalled(true);
      localStorage.removeItem(DISMISSED_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      window.matchMedia("(display-mode: standalone)").removeEventListener("change", checkInstalled);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let active = true;
    const handleControllerChange = () => {
      if (reloadAfterUpdate.current) window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((nextRegistration) => {
      if (!active) return;
      registration.current = nextRegistration;
      if (nextRegistration.waiting && navigator.serviceWorker.controller) setUpdateAvailable(true);

      nextRegistration.addEventListener("updatefound", () => {
        const installing = nextRegistration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });

      void nextRegistration.update().catch(() => undefined);
    }).catch(() => undefined);

    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const install = useCallback(async () => {
    const promptEvent = deferredPrompt.current;
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    deferredPrompt.current = null;
    setCanInstall(false);
    if (choice.outcome === "accepted") setIsInstalled(true);
  }, []);

  const updateNow = useCallback(() => {
    const waiting = registration.current?.waiting;
    if (!waiting) return;
    reloadAfterUpdate.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, []);

  const dismissInstallBanner = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setBannerDismissed(true);
  }, []);

  const value = useMemo<PwaContextValue>(() => ({
    isOnline,
    isInstalled,
    isIos,
    canInstall,
    updateAvailable,
    install,
    updateNow,
    dismissInstallBanner
  }), [isOnline, isInstalled, isIos, canInstall, updateAvailable, install, updateNow, dismissInstallBanner]);

  return (
    <PwaContext.Provider value={value}>
      {children}
      {!isOnline && (
        <div className="nexo-pwa-connection" role="status">
          <span aria-hidden="true">●</span> Sem conexão. Dados privados não ficam disponíveis offline.
        </div>
      )}
      {updateAvailable && (
        <div className="nexo-pwa-update" role="status">
          <span>Nova versão do NEXO disponível.</span>
          <button type="button" onClick={updateNow}>Atualizar</button>
        </div>
      )}
      {canInstall && !isInstalled && !bannerDismissed && (
        <aside className="nexo-pwa-install-banner" aria-label="Instalar NEXO">
          <div><strong>Tenha o NEXO no celular</strong><span>Instale para abrir em tela cheia.</span></div>
          <button type="button" onClick={() => void install()}>Instalar</button>
          <button type="button" className="dismiss" aria-label="Dispensar aviso de instalação" onClick={dismissInstallBanner}>×</button>
        </aside>
      )}
    </PwaContext.Provider>
  );
}
