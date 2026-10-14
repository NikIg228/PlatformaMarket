"use client";
import { DmButton } from "./actions";
import { ToastScope } from "./save-toast";
import { ActionFeedback } from "./action-feedback";
import { Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Spinner, Tag, Tooltip, type DropdownProps } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons/svg/dismiss";
import { Info20Regular } from "@fluentui/react-icons/svg/info";
import { Warning20Regular } from "@fluentui/react-icons/svg/warning";
import type { ReactNode } from "react";
function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** Open selector lists below their trigger and fit the available viewport. */
export const dmDropdownPositioning: DropdownProps["positioning"] = {
  position: "below",
  align: "start",
  strategy: "fixed",
  pinned: true,
  fallbackPositions: [],
  autoSize: "height",
  matchTargetSize: "width",
  overflowBoundaryPadding: 8,
};

/** Shared modal contract with Fluent focus trap, Escape handling and labelled title. */
export function DmDialog({
  open,
  onOpenChange,
  onClosed,
  title,
  description,
  children,
  actions,
  mobileFullscreen = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  mobileFullscreen?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)} surfaceMotion={onClosed ? { onMotionFinish: (_, data) => { if (data.direction === "exit") onClosed(); } } : undefined}>
      <DialogSurface className={joinClasses("dm-dialog-surface", mobileFullscreen ? "dm-dialog-mobile-fullscreen" : undefined)}>
        <DialogBody>
          <ToastScope />
          <DialogTitle
            action={
              <DmButton
                appearance="subtle"
                icon={<Dismiss24Regular />}
                aria-label="Закрыть окно"
                onClick={() => onOpenChange(false)}
              />
            }
          >
            {title}
          </DialogTitle>
          <DialogContent className="dm-dialog-content">
            {description ? (
              <p className="dm-dialog-description">{description}</p>
            ) : null}
            {children}
          </DialogContent>
          {actions ? <DialogActions>{actions}</DialogActions> : null}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export type DmTableColumn = {
  key: string;
  label: ReactNode;
};

/** Shared responsive table shell for dense operational data. */
export function DmTable({
  caption,
  columns,
  children,
  className,
}: {
  caption: string;
  columns: DmTableColumn[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="mp-table-wrap">
      <table className={joinClasses("mp-table", "dm-table", className)}>
        <caption className="dm-sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DmFeedback({
  tone = "info",
  title,
  description,
  icon,
  action,
  details,
  alert = false,
  presentation,
}: {
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  details?: ReactNode;
  alert?: boolean;
  presentation?: "inline" | "toast" | "note";
}) {
  if (presentation === "toast" || (presentation == null && (tone === "success" || tone === "danger"))) {
    return <ActionFeedback tone={tone} title={title} description={description} action={action} />;
  }
  return (
    <div
      className={`dm-feedback dm-feedback-${tone}${presentation === "note" ? " dm-feedback-note" : ""}`}
      role={alert ? "alert" : "status"}
      aria-live={alert ? "assertive" : "polite"}
    >
      {icon || presentation === "note" ? <span className="dm-feedback-icon" aria-hidden="true">{icon ?? (tone === "warning" || tone === "danger" ? <Warning20Regular /> : <Info20Regular />)}</span> : null}
      <div className="dm-feedback-copy">
        <strong>{title}</strong>
        <span>{description}</span>
        {details}
      </div>
      {action ? <div className="dm-feedback-action">{action}</div> : null}
    </div>
  );
}

/** Explicit reprice/stock/conflict state. Never hide a blocking change in a toast. */
export function DmConflictState({
  tone = "warning",
  title,
  description,
  icon,
  action,
  blocking = true,
}: {
  tone?: "warning" | "danger" | "neutral" | "success";
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  blocking?: boolean;
}) {
  return (
    <DmFeedback
      presentation="inline"
      tone={tone}
      title={title}
      description={description}
      icon={icon}
      action={action}
      alert={blocking}
    />
  );
}

export function PageHeader({
  hideHeading = false,
  eyebrow,
  title,
  description,
  actions,
}: {
  hideHeading?: boolean;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mp-page-header">
      {!hideHeading ? <div>
        {eyebrow ? <span className="mp-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div> : null}
      {actions ? <div className="mp-page-actions">{actions}</div> : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <article className="mp-metric">
      <span className="mp-metric-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </article>
  );
}

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export function StatusTag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  const appearance = tone === "neutral" ? "outline" : "filled";
  const color =
    tone === "danger"
      ? "danger"
      : tone === "warning"
        ? "warning"
        : tone === "success"
          ? "success"
          : "brand";
  return (
    <Tag
      className={`mp-status mp-status-${tone}`}
      appearance={appearance}
      shape="rounded"
      size="small"
      {...(tone === "neutral" ? {} : { color })}
    >
      {children}
    </Tag>
  );
}

export function LoadingState({
  label = "Загружаем данные",
}: {
  label?: string;
}) {
  return (
    <div className="mp-state">
      <Spinner size="medium" label={label} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mp-state mp-empty">
      <span aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Не удалось загрузить данные",
  description,
  action,
  presentation = "toast",
}: {
  title?: string;
  description: string;
  action?: ReactNode;
  presentation?: "inline" | "toast";
}) {
  if (presentation === "toast") return <ActionFeedback tone="error" title={title} description={description} action={action} />;
  return (
    <div className="mp-state mp-error" role="alert">
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mp-section ${className}`.trim()}>
      {title || description || action ? (
        <header>
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}
