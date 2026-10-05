"use client";
import { useEffect, useState } from "react";
import { Checkmark20Regular } from "@fluentui/react-icons/svg/checkmark";
import { Box24Regular } from "@fluentui/react-icons/svg/box";
import styles from "./product-workflow.module.css";

export function WorkflowSteps({ steps, current, label = "Этапы", onSelect }: { steps: string[]; current: number; label?: string; onSelect?: (index: number) => void }) {
  return <ol className={styles.steps} aria-label={label}>{steps.map((step, index) => <li key={step} data-complete={index < current} aria-current={index === current ? "step" : undefined}>
    {onSelect && index < current ? <button type="button" onClick={() => onSelect(index)}><span className={styles.stepNumber}><Checkmark20Regular /></span><span>{step}</span></button> : <span className={styles.stepLabel}><span className={styles.stepNumber}>{index < current ? <Checkmark20Regular /> : index + 1}</span><span>{step}</span></span>}
  </li>)}</ol>;
}

export function ProductThumbnail({ src, name, large = false }: { src?: string | null; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className={`${styles.thumbnail} ${large ? styles.large : ""}`}>
    {src && !failed ? <img src={src} alt={name} width={large ? 240 : 64} height={large ? 200 : 64} onError={() => setFailed(true)} /> : <Box24Regular aria-label="Изображение отсутствует" />}
  </div>;
}

/** Preserve drafts on accidental same-tab links and browser unload; no sensitive fields go into URLs. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) return;
      if (target.href === window.location.href || target.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("Есть несохранённые изменения. Покинуть страницу?")) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, [dirty]);
}

export { styles as productWorkflowStyles };
