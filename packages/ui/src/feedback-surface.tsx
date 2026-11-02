"use client";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { CheckmarkCircle20Regular } from "@fluentui/react-icons/svg/checkmark-circle";
import { ErrorCircle20Regular } from "@fluentui/react-icons/svg/error-circle";
import { Warning20Regular } from "@fluentui/react-icons/svg/warning";
import { Info20Regular } from "@fluentui/react-icons/svg/info";

export type FeedbackTone = "success" | "warning" | "danger" | "info" | "neutral";
const icons = { success: CheckmarkCircle20Regular, danger: ErrorCircle20Regular, warning: Warning20Regular, info: Info20Regular, neutral: Info20Regular };

/** Shared visual/announcement surface. Lifetime and recovery belong to callers. */
export function FeedbackSurface({ tone = "info", title, description, icon, action, details,
  presentation = "inline", alert = tone === "danger", className = "", ...props
}: Omit<ComponentPropsWithRef<"div">, "title" | "children"> & {
  tone?: FeedbackTone; title?: string; description: ReactNode; icon?: ReactNode;
  action?: ReactNode; details?: ReactNode; presentation?: "inline" | "note" | "toast"; alert?: boolean;
}) {
  const Icon = icons[tone];
  return <div {...props} className={`dm-notice ${presentation === "toast" ? "dm-save-toast" : `dm-feedback dm-feedback-${tone}`}${presentation === "note" ? " dm-feedback-note" : ""} ${className}`.trim()}
    data-tone={tone === "danger" ? "error" : tone} role={alert ? "alert" : "status"} aria-atomic="true">
    <span className="dm-feedback-icon" aria-hidden="true">{icon ?? <Icon />}</span>
    <div className="dm-feedback-copy">{title ? <strong>{title}</strong> : null}<span>{description}</span>{details}</div>
    {action ? <div className="dm-feedback-action">{action}</div> : null}
  </div>;
}
