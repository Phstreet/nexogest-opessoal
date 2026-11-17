"use client";

import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";

export default function ContaPage() {
  const { session, loading, signOut } = useNexoAuth();
  return (
    <AppLayout>
      <div className="content nexo-settings">
        <header className="page-heading">
          <div>
            <div className="eyebrow">SISTEMA / CONTA</div>
            <h1>Minha conta</h1>
            <p>Gerencie seu acesso e a sincronização dos seus dados.</p>
          </div>
        </header>
        <section className="settings-panel">
          {loading ? <p>Verificando sessão...</p> : session ? (
            <>
              <h2>Conta conectada</h2>
              <p>Você está conectado ao NEXO com o endereço abaixo.</p>
              <div className="backup-note">
                <strong>E-mail</strong>
                <span>{session.user.email || "E-mail não informado"}</span>
              </div>
              <div className="backup-actions">
                <button type="button" className="secondary-button" onClick={() => void signOut()}>Sair desta conta</button>
                <Link className="secondary-button" href="/configuracoes?tab=dados">Gerenciar backups</Link>
              </div>
              <p className="settings-note">Ao sair, os dados já salvos neste navegador permanecem no dispositivo. A sincronização em nuvem será interrompida até você entrar novamente.</p>
            </>
          ) : (
            <>
              <h2>Entre para sincronizar</h2>
              <p>Você está usando o NEXO no modo local. Entre ou crie uma conta para disponibilizar seus dados em outros dispositivos.</p>
              <div className="backup-actions">
                <Link className="primary-button" href="/entrar">Entrar</Link>
                <Link className="secondary-button" href="/cadastro">Criar conta</Link>
              </div>
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
