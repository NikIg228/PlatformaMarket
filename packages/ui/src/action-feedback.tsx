"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useToast, useToastAvailable, type ToastTone } from "./save-toast";

/** State-driven outcomes use the same toast as imperative commands.
 * Keep recovery actions in their original form after the five-second notice. */
export function ActionFeedback({ tone = "info", title, description, action }: {
  tone?: ToastTone | "danger" | "neutral";
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  const notify = useToast();
  const available = useToastAvailable();
  const last = useRef<string | null>(null);
  const resolvedTone = tone === "danger" ? "error" : tone === "neutral" ? "info" : tone;
  useEffect(() => {
    const identity = JSON.stringify([resolvedTone, title, description]);
    if (!available || !description || last.current === identity) return;
    last.current = identity;
    if (resolvedTone === "error" && !navigator.onLine) notify("Данные могут быть устаревшими.", { tone: "warning", title: "Нет подключения к сети" });
    else notify(description, { tone: resolvedTone, title });
  }, [available, description, notify, resolvedTone, title]);
  if (!available) return <div className="dm-feedback" role={resolvedTone === "error" ? "alert" : "status"}><strong>{title}</strong><span>{description}</span>{action}</div>;
  return action ? <div className="dm-feedback-recovery">{action}</div> : null;
}
