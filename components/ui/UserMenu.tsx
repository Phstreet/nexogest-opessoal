"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import { fetchRemoteCollections } from "@/lib/supabase/client";

export default function UserMenu() {
  const { session, loading, signOut } = useNexoAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!session) return;
    let active = true;
    async function loadProfile() {
      try {
        const rows = await fetchRemoteCollections(["nexo_profile"]);
        if (!active) return;
        const payload = rows.find((row) => row.data_key === "nexo_profile")?.payload;
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
        const profile = payload as Record<string, unknown>;
        setDisplayName(typeof profile.displayName === "string" ? profile.displayName : "");
        setAvatarUrl(typeof profile.avatarUrl === "string" && profile.avatarUrl.startsWith("data:image/webp;base64,") ? profile.avatarUrl : "");
      } catch {
        if (active) { setDisplayName(""); setAvatarUrl(""); }
      }
    }
    void loadProfile();
    window.addEventListener("nexo:profile-updated", loadProfile);
    return () => {
      active = false;
      window.removeEventListener("nexo:profile-updated", loadProfile);
    };
  }, [session]);

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      setOpen(false);
      router.replace("/entrar");
      router.refresh();
    }
  }

  if (loading) return null;
  if (!session) return <Link className="nexo-account-access" href="/entrar">Entrar / Criar conta <span aria-hidden="true">↗</span></Link>;

  const email = session.user.email || "Conta conectada";
  const label = displayName.trim() || email;
  const initial = label.trim().charAt(0).toLocaleUpperCase("pt-BR") || "N";

  return (
    <div className="nexo-account-menu">
      <button
        type="button"
        className="nexo-account-trigger"
        aria-label="Abrir menu da conta"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        {avatarUrl ? <img className="nexo-account-avatar nexo-account-avatar-image" src={avatarUrl} alt="" /> : <span className="nexo-account-avatar" aria-hidden="true">{initial}</span>}
        <span className="nexo-account-email">{label}</span>
        <span className="nexo-account-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="nexo-account-dropdown" role="menu">
          <Link href="/configuracoes?tab=seguranca" role="menuitem" onClick={() => setOpen(false)}>Conta e segurança</Link>
          <Link href="/configuracoes/perfil" role="menuitem" onClick={() => setOpen(false)}>Meu perfil</Link>
          <button type="button" role="menuitem" onClick={() => void handleSignOut()}>Sair da conta</button>
        </div>
      )}
    </div>
  );
}
