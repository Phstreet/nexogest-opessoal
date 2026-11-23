"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";

export default function UserMenu() {
  const { session, loading, signOut } = useNexoAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

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
  const initial = email.trim().charAt(0).toLocaleUpperCase("pt-BR") || "N";

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
        <span className="nexo-account-avatar" aria-hidden="true">{initial}</span>
        <span className="nexo-account-email">{email}</span>
        <span className="nexo-account-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="nexo-account-dropdown" role="menu">
          <Link href="/configuracoes/conta" role="menuitem" onClick={() => setOpen(false)}>Conta e segurança</Link>
          <Link href="/perfil" role="menuitem" onClick={() => setOpen(false)}>Meu perfil</Link>
          <button type="button" role="menuitem" onClick={() => void handleSignOut()}>Sair da conta</button>
        </div>
      )}
    </div>
  );
}
