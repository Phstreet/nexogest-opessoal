"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getStoredSession, refreshSession, signInWithPassword, signOutSession,
  signUpWithPassword, requestPasswordReset, updatePassword, storeSession,
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

  const syncSession = useCallback(() => setSession(getStoredSession()), []);

  useEffect(() => {
    const stored = getStoredSession();
    if (stored) {
      if (stored.expires_at <= Math.floor(Date.now() / 1000) + 60) {
        refreshSession(stored).then(setSession).catch(() => {
          storeSession(null);
          setSession(null);
        }).finally(() => setLoading(false));
      } else {
        setSession(stored);
        setLoading(false);
      }
    } else {
      // Links de recuperação do Supabase retornam tokens no fragmento da URL.
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const expiresIn = Number(hash.get("expires_in") || 3600);
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mmwkpwspyjvxsennvhic.supabase.co"}/auth/v1/user`, {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_-TkcxAdmwC_Mt-bLwUPQvw_x9JwKDyk",
            Authorization: `Bearer ${accessToken}`,
          },
        }).then((response) => response.ok ? response.json() : Promise.reject(new Error("Sessão de recuperação inválida.")))
          .then((user) => {
            const next: NexoSession = {
              access_token: accessToken, refresh_token: refreshToken, token_type: "bearer",
              expires_in: expiresIn, expires_at: Math.floor(Date.now() / 1000) + expiresIn, user,
            };
            storeSession(next);
            setSession(next);
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          }).catch(() => setSession(null)).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
    window.addEventListener("nexo:auth-changed", syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener("nexo:auth-changed", syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, [syncSession]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(async () => {
      const current = getStoredSession();
      if (!current || current.expires_at > Math.floor(Date.now() / 1000) + 180) return;
      try { setSession(await refreshSession(current)); }
      catch { storeSession(null); setSession(null); }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [session]);

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
      if (session) await signOutSession(session);
      setSession(null);
    },
    sendPasswordReset: requestPasswordReset,
    async changePassword(password) {
      if (!session) throw new Error("Entre na sua conta para alterar a senha.");
      await updatePassword(session, password);
    },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useNexoAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useNexoAuth deve ser utilizado dentro de NexoAuthProvider.");
  return context;
}
