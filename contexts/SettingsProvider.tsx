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
};

const SettingsContext = createContext<SettingsContextValue | null>(null);
const CACHE_PREFIX = "nexo_settings_cache_v1";
const SAVE_DELAY = 650;
const POLL_INTERVAL = 60_000;

type CacheEnvelope = { userId: string; settings: UserSettings };

function cacheKey(userId: string) {
  return \`\${CACHE_PREFIX}:\${userId}\`;
}

function readCache(userId: string): UserSettings | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
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
    localStorage.setItem("nexo_settings_bootstrap_v1", JSON.stringify({
      appearance: settings.appearance,
      finance: { hideValues: settings.finance.hideValues },
    }));
  } catch {
    // O cache é auxiliar; a persistência remota continua sendo a fonte oficial.
  }
}

function applySettings(settings: UserSettings) {
  const root = document.documentElement;
  const theme = settings.appearance.theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : settings.appearance.theme;
  const scale = settings.appearance.fontScale === "small" ? "0.92"
    : settings.appearance.fontScale === "large" ? "1.08" : "1";
  root.dataset.theme = theme;
  root.dataset.accent = settings.appearance.accent;
  root.dataset.density = settings.appearance.density;
  root.dataset.fontScale = settings.appearance.fontScale;
  root.dataset.reduceMotion = String(settings.appearance.reduceMotion);
  root.dataset.highContrast = String(settings.appearance.highContrast);
  root.dataset.privacyMode = String(settings.finance.hideValues);
  root.style.setProperty("--nexo-font-scale", scale);
  root.style.setProperty("--nexo-accent-color", accentColor(settings.appearance.accent));
}

function accentColor(accent: UserSettings["appearance"]["accent"]) {
  const colors: Record<UserSettings["appearance"]["accent"], string> = {
    silver: "#c5cbd4",
    blue: "#78a9e8",
    violet: "#a995e8",
    emerald: "#78c4a2",
    amber: "#d8b16c",
    rose: "#d994a6",
  };
  return colors[accent];
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
    if (!userId) return;
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
      const currentRevision = Number(currentRow?.revision) || revision.current;
      const currentPayload = currentRow?.payload && typeof currentRow.payload === "object" && !Array.isArray(currentRow.payload)
        ? currentRow.payload as Record<string, unknown>
        : {};
      const result = await saveRemoteCollection("nexo_preferences", {
        ...currentPayload,
        schemaVersion: 1,
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
        channel.close();
      }
    } catch (caught) {
      setSaveState("error");
      setError(caught instanceof Error ? caught.message : "Erro ao salvar as configurações.");
    }
  }, [userId]);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void persist(); }, SAVE_DELAY);
  }, [persist]);

  const updateSettings = useCallback((patch: SettingsPatch) => {
    setSettings((current) => {
      const next = mergeUserSettings(current, patch);
      latest.current = next;
      if (userId) writeCache(userId, next);
      applySettings(next);
      window.dispatchEvent(new CustomEvent("nexo:preferences-updated", {
        detail: { sidebarCollapsed: next.navigation.sidebarCompact },
      }));
      scheduleSave();
      return next;
    });
  }, [scheduleSave, userId]);

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
    if (!userId || typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("nexo-settings");
    channel.onmessage = (event: MessageEvent<{ userId?: string; settings?: unknown }>) => {
      if (event.data?.userId !== userId || !event.data.settings) return;
      const next = migrateUserSettings(event.data.settings);
      latest.current = next;
      setSettings(next);
      writeCache(userId, next);
      applySettings(next);
    };
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
  }), [settings, loaded, saveState, error, updateSettings, resetSection, togglePrivacy, retrySave, refresh]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings deve ser usado dentro de SettingsProvider.");
  return context;
}
