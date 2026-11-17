"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";

type Mode = "login" | "signup" | "recovery" | "reset";

export default function AuthForm({ mode }: { mode: Mode }) {
  const { signIn, signUp, sendPasswordReset, changePassword, session, loading } = useNexoAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (mode === "login" && session) router.replace("/");
  }, [mode, session, router]);

  const titles = {
    login: ["Acesse sua conta", "Entre para acessar seus dados e sincronizar seus dispositivos."],
    signup: ["Crie sua conta", "Sua conta protege e mantém seus dados disponíveis entre dispositivos."],
    recovery: ["Recuperar acesso", "Enviaremos um link para redefinir sua senha."],
    reset: ["Nova senha", "Defina uma nova senha para sua conta NEXO."],
  } as const;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
        router.replace("/");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
        const confirmationRequired = await signUp(email.trim(), password, name.trim());
        if (confirmationRequired) setMessage("Conta criada. Verifique seu e-mail para confirmar o cadastro e depois entre no NEXO.");
        else router.replace("/");
      } else if (mode === "recovery") {
        await sendPasswordReset(email.trim());
        setMessage("Se o endereço estiver cadastrado, você receberá um e-mail com as instruções para redefinir a senha.");
      } else {
        if (!session) throw new Error("Abra o link enviado ao seu e-mail para definir a nova senha.");
        if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
        if (password !== confirmation) throw new Error("As senhas não coincidem.");
        await changePassword(password);
        setMessage("Senha atualizada. Você já pode continuar usando o NEXO.");
        router.replace("/");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir. Tente novamente.");
    } finally { setBusy(false); }
  }

  return (
    <main className="nexo-auth-page">
      <section className="nexo-auth-card">
        <Link href="/" className="nexo-auth-brand"><span>N</span><strong>NEXO</strong></Link>
        <div className="nexo-auth-kicker">GESTÃO PESSOAL</div>
        <h1>{titles[mode][0]}</h1>
        <p className="nexo-auth-description">{titles[mode][1]}</p>
        {error && <div className="nexo-auth-feedback error" role="alert">{error}</div>}
        {message && <div className="nexo-auth-feedback success" role="status">{message}</div>}
        <form onSubmit={submit}>
          {mode === "signup" && <label>Nome de exibição<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} autoComplete="name" /></label>}
          {mode !== "reset" && <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>}
          {(mode === "login" || mode === "signup" || mode === "reset") && <label>{mode === "reset" ? "Nova senha" : "Senha"}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}
          {mode === "reset" && <label>Confirmar nova senha<input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" /></label>}
          <button type="submit" disabled={busy || (mode === "reset" && loading)}>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : mode === "recovery" ? "Enviar link de recuperação" : "Salvar nova senha"}</button>
        </form>
        <div className="nexo-auth-links">
          {mode === "login" && <><Link href="/recuperar-senha">Esqueci minha senha</Link><span>Não tem uma conta? <Link href="/cadastro">Criar conta</Link></span></>}
          {mode === "signup" && <span>Já possui uma conta? <Link href="/entrar">Entrar</Link></span>}
          {mode === "recovery" && <span>Lembrou a senha? <Link href="/entrar">Voltar ao login</Link></span>}
          {mode === "reset" && <Link href="/entrar">Voltar ao login</Link>}
        </div>
        <Link href="/" className="nexo-auth-back">← Voltar ao NEXO</Link>
      </section>
    </main>
  );
}
