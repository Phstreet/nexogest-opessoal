"use client";

import { useEffect, useRef } from "react";
import { useNexoAuth } from "@/contexts/NexoAuthProvider";
import { fetchRemoteCollections } from "@/lib/supabase/client";

/**
 * Removes only obsolete NEXO browser keys after the authenticated cloud
 * collections have been fetched successfully. No browser data is migrated
 * or used as a fallback; the user authorized deleting the local test data.
 */
export default function LegacyLocalDataCleanup() {
  const { session, loading } = useNexoAuth();
  const running = useRef(false);
  const completed = useRef(false);

  useEffect(() => {
    if (loading || !session) return;
    let active = true;

    async function cleanupAfterCloudLoad() {
      if (running.current || completed.current) return;
      running.current = true;
      try {
        await fetchRemoteCollections();
        if (!active) return;
        const keysToRemove: string[] = [];
        for (let index = 0; index < window.localStorage.length; index += 1) {
          const key = window.localStorage.key(index);
          if (key?.startsWith("nexo_")) keysToRemove.push(key);
        }
        for (const key of keysToRemove) window.localStorage.removeItem(key);
        completed.current = true;
      } catch (error) {
        console.warn("A limpeza dos dados locais antigos foi adiada porque a nuvem não pôde ser consultada.", error);
      } finally {
        running.current = false;
      }
    }

    void cleanupAfterCloudLoad();
    window.addEventListener("focus", cleanupAfterCloudLoad);
    return () => {
      active = false;
      window.removeEventListener("focus", cleanupAfterCloudLoad);
    };
  }, [session, loading]);

  return null;
}
