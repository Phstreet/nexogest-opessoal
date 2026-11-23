
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRemoteCollections } from "@/lib/supabase/client";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getFormattedDate() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export default function Header() {
  const [greeting, setGreeting] = useState("Olá");
  const [date, setDate] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    setGreeting(getGreeting());
    setDate(getFormattedDate());

    let active = true;
    async function loadProfile() {
      try {
        const collections = await fetchRemoteCollections(["nexo_profile"]);
        if (!active) return;
        const row = collections.find((item) => item.data_key === "nexo_profile");
        const payload = row?.payload;
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          setDisplayName("");
          return;
        }
        const profile = payload as { displayName?: unknown; fullName?: unknown };
        const name = typeof profile.displayName === "string"
          ? profile.displayName
          : typeof profile.fullName === "string" ? profile.fullName : "";
        setDisplayName(name);
      } catch (error) {
        console.error("Não foi possível carregar o perfil da nuvem:", error);
        if (active) setDisplayName("");
      }
    }

    void loadProfile();
    window.addEventListener("nexo:profile-updated", loadProfile);
    return () => {
      active = false;
      window.removeEventListener("nexo:profile-updated", loadProfile);
    };
  }, []);

  return (
    <header className="nexo-header">
      <div className="nexo-header-left">
        <span className="nexo-header-greeting">{greeting}</span>
        <strong>{displayName.trim() ? `Bem-vindo, ${displayName.trim()}.` : "Bem-vindo ao NEXO."}</strong>
        <span className="nexo-header-date">{date}</span>
      </div>

      <div className="nexo-header-actions">
        <button
          type="button"
          className="nexo-header-search"
          onClick={() => window.dispatchEvent(new Event("nexo:open-search"))}
          aria-label="Buscar no NEXO"
        >
          <span aria-hidden="true">⌕</span>
          <span>Buscar no NEXO</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="nexo-header-popover">
          <button
            type="button"
            className="nexo-header-icon"
            aria-label="Notificações"
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((current) => !current);
              setProfileOpen(false);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </button>

          {notificationsOpen && (
            <div className="nexo-header-dropdown notifications-dropdown">
              <strong>Notificações</strong>
              <p>Você não possui notificações no momento.</p>
            </div>
          )}
        </div>

        <div className="nexo-header-popover">
          <button
            type="button"
            className="nexo-profile-button"
            aria-label="Perfil"
            aria-expanded={profileOpen}
            onClick={() => {
              setProfileOpen((current) => !current);
              setNotificationsOpen(false);
            }}
          >
            <span className="nexo-profile-avatar">{displayName.trim().charAt(0).toUpperCase() || "N"}</span>
            <span className="nexo-profile-label">{displayName.trim() || "Perfil"}</span>
            <span className="nexo-profile-chevron">⌄</span>
          </button>

          {profileOpen && (
            <div className="nexo-header-dropdown profile-dropdown">
              <strong>{displayName.trim() || "NEXO"}</strong>
              <span>Perfil pessoal</span>
              <p>Gerencie seus dados pessoais e informações da conta.</p>
              <Link href="/perfil" className="profile-settings-link" onClick={() => setProfileOpen(false)}>Editar perfil</Link>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .nexo-header {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 13px 30px;
          background: #101012;
          border-bottom: 1px solid #29292d;
          position: relative;
          z-index: 20;
        }

        .nexo-header-left {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .nexo-header-greeting {
          color: #aeb4be;
          font-size: 10px;
        }

        .nexo-header-left strong {
          color: #f0f0f2;
          font-size: 15px;
          font-weight: 700;
        }

        .nexo-header-date {
          color: #777d87;
          font-size: 10px;
          text-transform: capitalize;
        }

        .nexo-header-actions {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .nexo-header-search {
          min-height: 37px;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 0 11px;
          border: 1px solid #35353a;
          border-radius: 7px;
          background: #19191c;
          color: #c5cad2;
          font: inherit;
          font-size: 11px;
          cursor: pointer;
          transition: border-color .18s ease, background .18s ease, color .18s ease;
        }
        .nexo-header-search:hover { border-color:#66666f; background:#222226; color:#fff; }
        .nexo-header-search>span:first-child { font-size:21px; line-height:1; }
        .nexo-header-search kbd { padding:3px 5px; border:1px solid #414148; border-radius:4px; color:#858b95; font-size:9px; }

        .nexo-header-popover {
          position: relative;
        }

        .nexo-header-icon {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          background: #19191c;
          border: 1px solid #35353a;
          border-radius: 7px;
          color: #c5cad2;
          cursor: pointer;
        }

        .nexo-header-icon svg {
          width: 17px;
          height: 17px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .nexo-profile-button {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 4px 8px 4px 4px;
          border: 1px solid #35353a;
          border-radius: 7px;
          background: #19191c;
          color: #d9dce1;
          cursor: pointer;
        }

        .nexo-profile-avatar {
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          background: linear-gradient(135deg, #d5d9df, #777e89);
          color: #111214;
          font-size: 12px;
          font-weight: 800;
        }

        .nexo-profile-label {
          font-size: 10px;
        }

        .nexo-profile-chevron {
          color: #858b95;
          font-size: 13px;
        }

        .nexo-header-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 245px;
          padding: 15px;
          background: #19191c;
          border: 1px solid #38383e;
          border-radius: 8px;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.35);
          color: #e5e7eb;
        }

        .nexo-header-dropdown strong {
          display: block;
          font-size: 12px;
        }

        .nexo-header-dropdown p {
          margin: 10px 0 0;
          color: #9298a2;
          font-size: 10px;
          line-height: 1.6;
        }

        .profile-settings-link { display:inline-block; margin-top:12px; color:#dedede; font-size:10px; text-decoration:underline; }
        .nexo-header-dropdown > span {
          display: block;
          margin-top: 5px;
          color: #9298a2;
          font-size: 10px;
        }

        @media (max-width: 760px) {
          .nexo-header {
            min-height: 68px;
            padding: 10px 14px;
          }

          .nexo-header-left strong {
            font-size: 13px;
          }

          .nexo-header-date {
            font-size: 9px;
          }

          .nexo-profile-label,
          .nexo-profile-chevron {
            display: none;
          }
          .nexo-header-search { width:37px; justify-content:center; padding:0; }
          .nexo-header-search>span:nth-child(2), .nexo-header-search kbd { display:none; }
        }
      `}</style>
    </header>
  );
}
