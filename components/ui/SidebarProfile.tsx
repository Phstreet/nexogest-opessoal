"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRemoteCollections } from "@/lib/supabase/client";

export default function SidebarProfile() {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const rows = await fetchRemoteCollections(["nexo_profile"]);
        if (!active) return;
        const payload = rows.find((row) => row.data_key === "nexo_profile")?.payload;
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
        const profile = payload as Record<string, unknown>;
        setName(typeof profile.displayName === "string" ? profile.displayName : "");
        setAvatar(typeof profile.avatarUrl === "string" && profile.avatarUrl.startsWith("data:image/webp;base64,") ? profile.avatarUrl : "");
      } catch {
        if (active) { setName(""); setAvatar(""); }
      }
    }
    void load();
    window.addEventListener("nexo:profile-updated", load);
    return () => {
      active = false;
      window.removeEventListener("nexo:profile-updated", load);
    };
  }, []);
  if (!name && !avatar) return null;
  const initial = name.trim().charAt(0).toLocaleUpperCase("pt-BR") || "N";
  return (
    <Link href="/configuracoes/perfil" className="sidebar-profile" title="Abrir Perfil e Dados">
      {avatar ? <img src={avatar} alt="" /> : <span className="sidebar-profile-avatar">{initial}</span>}
      <span className="sidebar-profile-copy"><strong>{name || "Meu perfil"}</strong><small>Perfil e dados</small></span>
    </Link>
  );
}
