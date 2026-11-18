"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";

export default function AccountAccess() {
  const { session, loading, signOut } = useNexoAuth();
  const router = useRouter();

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      router.replace("/entrar");
      router.refresh();
    }
  }
  if (loading) return null;
  if (!session) return <Link className="nexo-account-access" href="/entrar">Entrar / Criar conta <span>↗</span></Link>;
  return (
    <div className="nexo-account-access nexo-account-connected">
      <span className="nexo-account-indicator" />
      <span>{session.user.email || "Conta conectada"}</span>
      <Link href="/configuracoes/conta">Conta</Link>
      <button type="button" onClick={() => void handleSignOut()}>Sair</button>
    </div>
  );
}
