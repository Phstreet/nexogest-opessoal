"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import {
  fetchRemoteCollections,
  saveRemoteCollection,
} from "@/lib/supabase/client";
import {
  DEFAULT_USER_SETTINGS,
  mergeUserSettings,
  migrateUserSettings,
  type SettingsPatch,
  type SettingsSection,
  type UserSettings,
} from "@/lib/settings/schema";

type SaveState = "loading" | "saved" | "saving" | "error" | "offline";

type SettingsContextValue = {
  settings: UserSettings;
  loaded: boolean;
  saveState: SaveState;
  error: string;
  updateSettings: (patch: SettingsPatch) => void;
  resetSection: (section: SettingsSection) => void;
  togglePrivacy: () => void;
  retrySave: () => void;
  refresh: () => Promise<void>;
  previewAppearance: (appearance: UserSettings["appearance"]) => void;
  saveAppearance: (appearance: UserSettings["appearance"]) => void;
  discardAppearance: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);
const CACHE_PREFIX = "nexo_settings_cache_v2";
const SAVE_DELAY = 650;
const POLL_INTERVAL = 60_000;

type CacheEnvelope = { userId: string; settings: UserSettings };

function cacheKey(userId: string) {
  return CACHE_PREFIX + ":" + userId;
}

function readCache(userId: string): UserSettings | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId)) ?? localStorage.getItem("nexo_settings_cache_v1:" + userId);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return migrateUserSettings((parsed as CacheEnvelope).settings);
  } catch {
    return null;
  }
}

function writeCache(userId: string, settings: UserSettings) {
  try {
    const envelope: CacheEnvelope = { userId, settings };
    localStorage.setItem(cacheKey(userId), JSON.stringify(envelope));
    const bootstrap = {
      appearance: settings.appearance,
      finance: { hideValues: settings.finance.hideValues },
    };
    localStorage.setItem("nexo_settings_bootstrap_v2", JSON.stringify(bootstrap));
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = "nexo_appearance_v2=" + encodeURIComponent(JSON.stringify(bootstrap)) +
      "; Path=/; Max-Age=31536000; SameSite=Lax" + secure;
  } catch {
    // O cache é auxiliar; a persistência remota continua sendo a fonte oficial.
  }
}

function applySettings(settings: UserSettings) {
  const root = document.documentElement;
  const theme = settings.appearance.theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "graphite")
    : settings.appearance.theme;
  root.dataset.theme = theme;
  root.dataset.accent = settings.appearance.accent;
  root.dataset.density = settings.appearance.density;
  root.dataset.fontScale = settings.appearance.fontScale;
  root.dataset.cornerRadius = settings.appearance.cornerRadius;
  root.dataset.reduceMotion = String(settings.appearance.reduceMotion);
  root.dataset.highContrast = String(settings.appearance.highContrast);
  root.dataset.privacyMode = String(settings.finance.hideValues);
}


export function SettingsProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading, signOut } = useNexoAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [error, setError] = useState("");
  const revision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(settings);
  const userId = session?.user.id ?? "";

  const refresh = useCallback(async () => {
    if (!userId || timer.current) return;
    const rows = await fetchRemoteCollections(["nexo_preferences"]);
    const row = rows.find((item) => item.data_key === "nexo_preferences");
    revision.current = Number(row?.revision) || 0;
    const next = migrateUserSettings(row?.payload ?? {});
    latest.current = next;
    setSettings(next);
    writeCache(userId, next);
    setSaveState("saved");
    setError("");
  }, [userId]);

  const persist = useCallback(async () => {
    timer.current = null;
    if (!userId) {
      setSaveState("offline");
      setError("Entre na sua conta para sincronizar as configurações.");
      return;
    }
    setSaveState("saving");
    setError("");
    try {
      const currentRows = await fetchRemoteCollections(["nexo_preferences"]);
      const currentRow = currentRows.find((item) => item.data_key === "nexo_preferences");
      const currentRevision = Number(currentRow?.revision) || 0;
      if (currentRevision !== revision.current) {
        revision.current = currentRevision;
        throw new Error("As configurações foram alteradas em outro dispositivo. Os dados mais recentes foram preservados; atualize a tela antes de tentar novamente.");
      }
      const currentPayload = currentRow?.payload && typeof currentRow.payload === "object" && !Array.isArray(currentRow.payload)
        ? currentRow.payload as Record<string, unknown>
        : {};
      const result = await saveRemoteCollection("nexo_preferences", {
        ...currentPayload,
        schemaVersion: latest.current.schemaVersion,
        settingsV1: latest.current,
        weekStartsOn: latest.current.general.weekStartsOn === 0 ? "sunday" : "monday",
        sidebarCollapsed: latest.current.navigation.sidebarCompact,
      }, currentRevision);
      if (!result.saved) {
        revision.current = Number(result.current_revision) || currentRevision;
        throw new Error("As configurações foram alteradas em outro dispositivo. Atualize os dados e tente novamente.");
      }
      revision.current = result.current_revision ?? currentRevision + 1;
      setSaveState("saved");
      setError("");
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel("nexo-settings");
        channel.postMessage({ userId, settings: latest.current });
        channel?.close();
      }
    } catch (caught) {
      setSaveState("error");
      setError(caught instanceof Error ? caught.message : "Erro ao salvar as configurações.");
    }
  }, [userId]);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void persist(); }, SAVE_DELAY);
  }, [persist]);

  const updateSettings = useCallback((patch: SettingsPatch) => {
    const next = mergeUserSettings(latest.current, patch);
    latest.current = next;
    setSettings(next);
    if (userId) writeCache(userId, next);
    applySettings(next);
    window.dispatchEvent(new CustomEvent("nexo:preferences-updated", {
      detail: { sidebarCollapsed: next.navigation.sidebarCompact },
    }));
    scheduleSave();
  }, [scheduleSave, userId]);

  const previewAppearance = useCallback((appearance: UserSettings["appearance"]) => {
    applySettings({ ...latest.current, appearance });
  }, []);

  const saveAppearance = useCallback((appearance: UserSettings["appearance"]) => {
    updateSettings({ appearance });
  }, [updateSettings]);

  const discardAppearance = useCallback(() => {
    applySettings(latest.current);
  }, []);

  const resetSection = useCallback((section: SettingsSection) => {
    const defaults = DEFAULT_USER_SETTINGS[section];
    updateSettings({ [section]: defaults } as SettingsPatch);
  }, [updateSettings]);

  const togglePrivacy = useCallback(() => {
    updateSettings({ finance: { hideValues: !latest.current.finance.hideValues } });
  }, [updateSettings]);

  const retrySave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void persist();
  }, [persist]);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setSettings(DEFAULT_USER_SETTINGS);
      latest.current = DEFAULT_USER_SETTINGS;
      setLoaded(true);
      setSaveState("offline");
      return;
    }

    const cached = readCache(session.user.id);
    if (cached) {
      latest.current = cached;
      setSettings(cached);
      applySettings(cached);
    }

    let active = true;
    setLoaded(Boolean(cached));
    setSaveState(cached ? "saving" : "loading");
    void refresh().catch((caught) => {
      if (!active) return;
      setSaveState("offline");
      setError(caught instanceof Error ? caught.message : "Sem conexão com a nuvem.");
      setLoaded(true);
    }).finally(() => {
      if (active) setLoaded(true);
    });
    return () => { active = false; };
  }, [authLoading, session, refresh]);

  useEffect(() => {
    if (!userId) return;
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("nexo-settings") : null;
    if (channel) {
      channel.onmessage = (event: MessageEvent<{ userId?: string; settings?: unknown }>) => {
        if (event.data?.userId !== userId || !event.data.settings) return;
        const next = migrateUserSettings(event.data.settings);
        latest.current = next;
        setSettings(next);
        writeCache(userId, next);
        applySettings(next);
      };
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== cacheKey(userId) || !event.newValue) return;
      try {
        const envelope = JSON.parse(event.newValue) as CacheEnvelope;
        const next = migrateUserSettings(envelope.settings);
        latest.current = next;
        setSettings(next);
        applySettings(next);
      } catch {
        // Ignora cache corrompido de outra aba.
      }
    };
    window.addEventListener("storage", onStorage);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh().catch(() => undefined);
    }, POLL_INTERVAL);
    const onFocus = () => { void refresh().catch(() => undefined); };
    window.addEventListener("focus", onFocus);
    return () => {
      channel.close();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
    };
  }, [userId, refresh]);

  useEffect(() => {
    applySettings(settings);
  }, [settings]);

  useEffect(() => {
    const root = document.getElementById("nexo-app");
    if (!root) return;
    const moneyPattern = /(?:R\$|BRL)\s*[-+]?\d[\d.]*,\d{2}/i;

    function markMoneyValues() {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      while (node) {
        const parent = node.parentElement;
        if (parent && parent.id !== "nexo-app" && moneyPattern.test(parent.textContent || "")) {
          parent.setAttribute("data-sensitive", "auto");
        }
        node = walker.nextNode();
      }
    }

    if (!settings.finance.hideValues) {
      root.querySelectorAll('[data-sensitive="auto"]').forEach((element) => element.removeAttribute("data-sensitive"));
      return;
    }

    markMoneyValues();
    const observer = new MutationObserver(markMoneyValues);
    observer.observe(root, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [settings.finance.hideValues]);

  useEffect(() => {
    if (settings.appearance.theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => applySettings(settings);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [settings]);

  useEffect(() => {
    const homePage = settings.general.homePage;
    if (pathname === "/" && homePage !== "/") router.replace(homePage);
  }, [pathname, router, settings.general.homePage]);

  useEffect(() => {
    const minutes = settings.security.inactivityMinutes;
    if (!minutes || !session) return;
    let timeout: ReturnType<typeof setTimeout>;
    const expire = () => {
      void signOut().finally(() => router.replace("/entrar?reason=inactivity"));
    };
    const reset = () => {
      clearTimeout(timeout);
      timeout = setTimeout(expire, minutes * 60_000);
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "mousemove", "touchstart"];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [settings.security.inactivityMinutes, session, signOut, router]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo<SettingsContextValue>(() => ({
    settings,
    loaded,
    saveState,
    error,
    updateSettings,
    resetSection,
    togglePrivacy,
    retrySave,
    refresh,
    previewAppearance,
    saveAppearance,
    discardAppearance,
  }), [settings, loaded, saveState, error, updateSettings, resetSection, togglePrivacy, retrySave, refresh, previewAppearance, saveAppearance, discardAppearance]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings deve ser usado dentro de SettingsProvider.");
  return context;
}
