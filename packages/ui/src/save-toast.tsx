"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Portal, useDialogContext_unstable, type DialogContextValue } from "@fluentui/react-components";
import { CheckmarkCircle20Regular } from "@fluentui/react-icons/svg/checkmark-circle";
import { ErrorCircle20Regular } from "@fluentui/react-icons/svg/error-circle";
import { Warning20Regular } from "@fluentui/react-icons/svg/warning";
import { Info20Regular } from "@fluentui/react-icons/svg/info";
import { Dismiss20Regular } from "@fluentui/react-icons/svg/dismiss";
import { DmButton } from "./controls";

export type ToastTone = "success" | "error" | "warning" | "info";
export type ToastOptions = { tone?: ToastTone; title?: string };
type Notify = (message: string, options?: ToastOptions) => void;
type DialogAttributes = DialogContextValue["modalAttributes"];
type ToastNotice = { id: number; message: string; tone: ToastTone; title: string; owner: symbol; dialogAttributes?: DialogAttributes };
const ToastContext = createContext<{
  notify: (message: string, options: ToastOptions, owner: symbol, dialogAttributes?: DialogAttributes) => void;
  syncOwner: (owner: symbol, dialogAttributes?: DialogAttributes) => void;
} | null>(null);
export function useToast(): Notify {
  const context = useContext(ToastContext);
  const dialogAttributes = useDialogContext_unstable(dialog => dialog.open ? dialog.modalAttributes : undefined);
  const owner = useRef(Symbol("toast-owner"));
  // A toast triggered inside a Fluent dialog participates in that same focus/
  // announcement group. Release it when the originating surface closes.
  useEffect(() => {
    const id = owner.current;
    context?.syncOwner(id, dialogAttributes);
    return () => context?.syncOwner(id);
  }, [context, dialogAttributes]);
  return useCallback((message, options = {}) => context?.notify(message, options, owner.current, dialogAttributes), [context, dialogAttributes]);
}
export const useToastAvailable = () => useContext(ToastContext) !== null;
export const useSaveToast = useToast;
const labels = { success: "Успешно", error: "Ошибка", warning: "Внимание", info: "Информация" };
const icons = { success: CheckmarkCircle20Regular, error: ErrorCircle20Regular, warning: Warning20Regular, info: Info20Regular };

/** Shared action feedback. Field errors and recovery controls stay at the action. */
export function SaveToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const [leaving, setLeaving] = useState(false);
  const sequence = useRef(0);
  const card = useRef<HTMLDivElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const notify = useCallback((message: string, options: ToastOptions, owner: symbol, dialogAttributes?: DialogAttributes) => {
    const tone = options.tone ?? "success";
    if (!card.current?.contains(document.activeElement)) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLeaving(false); setNotice({ id: ++sequence.current, message, tone, title: options.title ?? labels[tone], owner, dialogAttributes });
  }, []);
  const syncOwner = useCallback((owner: symbol, dialogAttributes?: DialogAttributes) => setNotice(current => current?.owner === owner && current.dialogAttributes !== dialogAttributes ? { ...current, dialogAttributes } : current), []);
  const [context] = useState(() => ({ notify, syncOwner }));
  const dismiss = useCallback(() => {
    if (card.current?.contains(document.activeElement) && returnFocus.current?.isConnected) returnFocus.current.focus();
    setNotice(null);
  }, []);
  const noticeId = notice?.id;
  useEffect(() => {
    if (!noticeId) return;
    const slide = window.setTimeout(() => setLeaving(true), 5000);
    const remove = window.setTimeout(dismiss, 5220);
    return () => { window.clearTimeout(slide); window.clearTimeout(remove); };
  }, [noticeId, dismiss]);
  const Icon = notice ? icons[notice.tone] : Info20Regular;
  return <ToastContext.Provider value={context}>{children}{notice ? <Portal mountNode={{className:"dm-toast-portal"}}><div className="dm-save-toast-viewport" {...notice.dialogAttributes}>
    <div ref={card} key={notice.id} className="dm-save-toast" role={notice.tone === "error" ? "alert" : "status"} aria-atomic="true" data-tone={notice.tone} data-leaving={leaving || undefined}>
      <Icon aria-hidden="true" /><div className="dm-toast-copy"><strong>{notice.title}</strong><span>{notice.message}</span></div>
      <DmButton appearance="subtle" density="compact" icon={<Dismiss20Regular />} aria-label="Закрыть уведомление" onClick={dismiss} />
    </div>
  </div></Portal> : null}</ToastContext.Provider>;
}
