"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Portal, useDialogContext_unstable, type DialogContextValue } from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons/svg/dismiss";
import { DmButton } from "./actions";
import { useConnectionMonitor } from "./use-connection-monitor";
import { FeedbackSurface } from "./feedback-surface";

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
/** Register a dialog's modalizer even before its first action produces a toast. */
export function ToastScope() { useToast(); return null; }
const labels = { success: "Успешно", error: "Ошибка", warning: "Внимание", info: "Информация" };

/** Shared action feedback. Field errors and recovery controls stay at the action. */
export function SaveToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const [leaving, setLeaving] = useState(false);
  const sequence = useRef(0);
  const owners = useRef(new Map<symbol, DialogAttributes>());
  const networkOwner = useRef(Symbol("connection"));
  const [connectionDismissed, setConnectionDismissed] = useState(false);
  const connectionCard = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const lastDialog = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target !== document.body && !card.current?.contains(event.target) && !connectionCard.current?.contains(event.target)) {
        lastFocused.current = event.target;
        lastDialog.current = event.target.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]');
      }
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);
  const notify = useCallback((message: string, options: ToastOptions, owner: symbol, dialogAttributes?: DialogAttributes) => {
    if (!navigator.onLine && (options.title === "Нет подключения к сети" || /^(Нет подключения к сети|Нет сети)/.test(message))) {
      // The persistent connection card already announces this interruption.
      return;
    }
    const tone = options.tone ?? "success";
    if (!card.current?.contains(document.activeElement)) returnFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : lastFocused.current;
    setLeaving(false); setNotice({ id: ++sequence.current, message, tone, title: options.title ?? labels[tone], owner, dialogAttributes });
  }, []);
  const syncOwner = useCallback((owner: symbol, dialogAttributes?: DialogAttributes) => {
    if (dialogAttributes) owners.current.set(owner, dialogAttributes); else owners.current.delete(owner);
    setNotice(current => {
      if (!current) return current;
      const attributes = current.owner === networkOwner.current ? [...owners.current.values()].at(-1) : current.owner === owner ? dialogAttributes : current.dialogAttributes;
      return attributes === current.dialogAttributes ? current : { ...current, dialogAttributes: attributes };
    });
  }, []);
  const [context] = useState(() => ({ notify, syncOwner }));
  const connection = useConnectionMonitor((state, recovered) => {
    setConnectionDismissed(false);
    if (state === "offline") setNotice(current => current?.owner === networkOwner.current ? null : current);
    if (recovered) notify("Сервис снова доступен.", { tone: "success", title: "Связь восстановлена" }, networkOwner.current, [...owners.current.values()].at(-1));
  });
  const dismiss = useCallback(() => {
    if (card.current?.contains(document.activeElement)) {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
      // A successful retry can unmount its trigger. Keep keyboard users inside
      // the same open dialog rather than dropping focus onto document.body.
      if (card.current.contains(document.activeElement) && lastDialog.current?.isConnected) lastDialog.current.focus();
    }
    setNotice(null);
  }, []);
  const noticeId = notice?.id;
  useEffect(() => {
    if (!noticeId) return;
    const slide = window.setTimeout(() => setLeaving(true), 5000);
    const remove = window.setTimeout(dismiss, 5220);
    return () => { window.clearTimeout(slide); window.clearTimeout(remove); };
  }, [noticeId, dismiss]);
  return <ToastContext.Provider value={context}>{children}{notice || connection !== "online" ? <Portal mountNode={{className:"dm-toast-portal"}}><div className="dm-save-toast-viewport" {...(notice?.dialogAttributes ?? [...owners.current.values()].at(-1))}>
    {notice ? <FeedbackSurface ref={card} key={notice.id} presentation="toast" tone={notice.tone === "error" ? "danger" : notice.tone}
      title={notice.title} description={notice.message} data-leaving={leaving || undefined}
      action={<DmButton appearance="subtle" density="compact" icon={<Dismiss20Regular />} aria-label="Закрыть уведомление" onClick={dismiss} />} /> : null}
    {connection !== "online" && !connectionDismissed ? <FeedbackSurface ref={connectionCard} presentation="toast" tone="warning" data-connection-notice="true"
      title={connection === "offline" ? "Нет подключения к сети" : connection === "checking" ? "Проверяем соединение…" : "Сервис пока недоступен"}
      description={connection === "offline" ? "Данные могут быть устаревшими. Проверьте подключение к интернету." : "Данные могут быть устаревшими. Автоматически проверяем доступность сервиса."}
      action={<DmButton appearance="subtle" density="compact" icon={<Dismiss20Regular />} aria-label="Закрыть уведомление" onClick={() => {
        if (connectionCard.current?.contains(document.activeElement)) {
          if (lastFocused.current?.isConnected) lastFocused.current.focus();
          if (connectionCard.current.contains(document.activeElement) && lastDialog.current?.isConnected) lastDialog.current.focus();
        }
        setConnectionDismissed(true);
      }} /> } /> : null}
  </div></Portal> : null}</ToastContext.Provider>;
}
