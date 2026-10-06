"use client";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { WorkspaceOffer } from "@marketplace/schemas";
import styles from "./offer-editors.module.css";

export type OfferEditorProps = {
  offer: WorkspaceOffer;
  footer: HTMLElement | null;
  onDirtyChange: (dirty: boolean) => void;
  onLockChange: (locked: boolean) => void;
  onSaved: (message: string) => Promise<void>;
  onCancel: () => void;
};
export function EditorActions({ host, children }: { host: HTMLElement | null; children: ReactNode }) {
  return host ? createPortal(<div className={styles.actions}>{children}</div>, host) : null;
}
export function useEditorGuard(props: Pick<OfferEditorProps, "onDirtyChange" | "onLockChange">, dirty: boolean, locked: boolean) {
  const { onDirtyChange, onLockChange } = props;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => { onLockChange(locked); return () => onLockChange(false); }, [locked, onLockChange]);
}
export function responseStatus(cause: unknown) {
  return cause && typeof cause === "object" && "status" in cause && typeof cause.status === "number" ? cause.status : undefined;
}
export const confirmDiscard = () => window.confirm("Есть несохранённые изменения. Продолжить без сохранения?");
