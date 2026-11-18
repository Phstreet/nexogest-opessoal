"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (value: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function NexoConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setPending({ ...options, resolve });
    });
  }, []);

  const finish = useCallback((accepted: boolean) => {
    resolverRef.current?.(accepted);
    resolverRef.current = null;
    setPending(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="nexo-confirm-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) finish(false);
        }}>
          <section
            className="nexo-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="nexo-confirm-title"
            aria-describedby="nexo-confirm-message"
          >
            <div className="nexo-confirm-icon" aria-hidden="true">
              {pending.destructive ? "!" : "?"}
            </div>
            <div className="nexo-confirm-copy">
              <h2 id="nexo-confirm-title">{pending.title || "Confirmar ação"}</h2>
              <p id="nexo-confirm-message">{pending.message}</p>
            </div>
            <div className="nexo-confirm-actions">
              <button type="button" className="nexo-confirm-cancel" onClick={() => finish(false)}>
                {pending.cancelLabel || "Cancelar"}
              </button>
              <button
                type="button"
                className={pending.destructive ? "nexo-confirm-accept is-danger" : "nexo-confirm-accept"}
                onClick={() => finish(true)}
                autoFocus
              >
                {pending.confirmLabel || "Confirmar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useNexoConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useNexoConfirm deve ser usado dentro de NexoConfirmProvider.");
  return confirm;
}
