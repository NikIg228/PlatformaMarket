"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Portal } from "@fluentui/react-components";
import { CheckmarkCircle20Regular } from "@fluentui/react-icons/svg/checkmark-circle";
import { Dismiss20Regular } from "@fluentui/react-icons/svg/dismiss";
import { DmButton } from "./controls";

const ToastContext = createContext<(message: string) => void>(() => undefined);
export const useSaveToast = () => useContext(ToastContext);

/** Acknowledgements only. Validation and blocking errors remain at the action. */
export function SaveToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const sequence = useRef(0);
  const notify = useCallback((message: string) => { setLeaving(false); setNotice({ id: ++sequence.current, message }); }, []);
  useEffect(() => {
    if (!notice) return;
    const slide = window.setTimeout(() => setLeaving(true), 5000);
    const remove = window.setTimeout(() => setNotice(null), 5220);
    return () => { window.clearTimeout(slide); window.clearTimeout(remove); };
  }, [notice]);
  return <ToastContext.Provider value={notify}>{children}{notice ? <Portal><div className="dm-save-toast-viewport" aria-live="polite" aria-atomic="true">
    <div key={notice.id} className="dm-save-toast" role="status" data-leaving={leaving || undefined}>
      <CheckmarkCircle20Regular aria-hidden="true" /><span>{notice.message}</span>
      <DmButton appearance="subtle" density="compact" icon={<Dismiss20Regular />} aria-label="Закрыть уведомление" onClick={() => setNotice(null)} />
    </div>
  </div></Portal> : null}</ToastContext.Provider>;
}
