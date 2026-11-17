"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getCurrentSession, signInWithPassword, signOutSession, signUpWithPassword,
  requestPasswordReset, updatePassword, setRecoverySession,
  type NexoSession,
} from "@/lib/supabase/client";

type AuthContextValue = {
  session: NexoSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  changePassword: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function NexoAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<NexoSession | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try { setSession(await getCurrentSession()); }
    catch { setSession(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        try {
          const recovered = await setRecoverySession(accessToken, refreshToken, Number(hash.get("expires_in") || 3600));
          if (active) setSession(recovered);
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        } catch {
          if (active) setSession(null);
        } finally {
          if (active) setLoading(false);
        }
        return;
      }
      await loadSession();
    }
    void initialize();
    const refreshOnFocus = () => { if (document.visibilityState === "visible") void loadSession(); };
    window.addEventListener("focus", refreshOnFocus);
    return () => { active = false; window.removeEventListener("focus", refreshOnFocus); };
  }, [loadSession]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => { void loadSession(); }, 4 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [session, loadSession]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    loading,
    async signIn(email, password) { setSession(await signInWithPassword(email, password)); },
    async signUp(email, password, displayName) {
      const result = await signUpWithPassword(email, password, displayName);
      setSession(result.session);
      return result.confirmationRequired;
    },
    async signOut() {
      try { await signOutSession(); }
      finally { setSession(null); }
    },
    sendPasswordReset: requestPasswordReset,
    async changePassword(password) {
      if (!session) throw new Error("Entre na sua conta para alterar a senha.");
      await updatePassword(password);
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useNexoAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useNexoAuth deve ser utilizado dentro de NexoAuthProvider.");
  return context;
}
