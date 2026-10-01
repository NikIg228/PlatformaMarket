"use client";
export { MemberManagement } from "./member-management";
export { SessionManagement } from "./session-management";
export { PermissionsProvider, PermissionFields, usePermissions } from "./permissions";
export { documentArchiveDateRange, DOCUMENT_ARCHIVE_TIME_ZONE } from "./document-date-range";
export { MarketplaceProvider } from "./provider";
import { ThemeContext } from "./provider";

export * from "./document-archive";
export * from "./document-relations";
export { OrganizationProfileForm } from "./organization-profile-form";
export { useSessionLogout } from "./use-session-logout";

import {
  Avatar,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Select,
  Spinner,
  Tag,
  Textarea,
  Tooltip,
  type ButtonProps,
  type CheckboxProps,
  type FieldProps,
  type DropdownProps,
  type InputProps,
  type SelectProps,
  type TextareaProps,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons/svg/dismiss";
import { Navigation24Regular } from "@fluentui/react-icons/svg/navigation";
import { SignOut24Regular } from "@fluentui/react-icons/svg/sign-out";
import { WeatherMoon24Regular } from "@fluentui/react-icons/svg/weather-moon";
import { WeatherSunny24Regular } from "@fluentui/react-icons/svg/weather-sunny";
import type { ReactNode } from "react";
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

/** Shared field wrapper for all role workspaces. */
export function DmField({ className, ...props }: FieldProps) {
  return <Field {...props} className={joinClasses("dm-field", className)} />;
}

/** Shared text input with the marketplace control contract. */
export function DmInput({ className, ...props }: InputProps) {
  return <Input {...props} className={joinClasses("dm-control", "dm-input", className)} />;
}

/** Shared multiline input with the marketplace control contract. */
export function DmTextarea({ className, ...props }: TextareaProps) {
  return <Textarea {...props} className={joinClasses("dm-control", "dm-textarea", className)} />;
}

/** Shared native-select based Fluent control. */
export function DmSelect({ className, ...props }: SelectProps) {
  return <Select {...props} className={joinClasses("dm-control", "dm-select", className)} />;
}

/** Shared action control. Keep action hierarchy in one component boundary. */
export function DmButton({ className, ...props }: ButtonProps) {
  const appearance = props.appearance ?? "secondary";
  return (
    <Button
      {...props}
      appearance={appearance}
      data-dm-appearance={appearance}
      className={joinClasses("dm-button", className)}
    />
  );
}

/** Shared checkbox control for filters and capability selections. */
export function DmCheckbox({ className, ...props }: CheckboxProps) {
  return <Checkbox {...props} className={joinClasses("dm-checkbox", className)} />;
}

/** Shared modal contract with Fluent focus trap, Escape handling and labelled title. */
export function DmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface className="dm-dialog-surface">
        <DialogBody>
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
  alert = false,
}: {
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div
      className={`dm-feedback dm-feedback-${tone}`}
      role={alert ? "alert" : "status"}
      aria-live={alert ? "assertive" : "polite"}
    >
      {icon ? <span className="dm-feedback-icon" aria-hidden="true">{icon}</span> : null}
      <div className="dm-feedback-copy">
        <strong>{title}</strong>
        <span>{description}</span>
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
      tone={tone}
      title={title}
      description={description}
      icon={icon}
      action={action}
      alert={blocking}
    />
  );
}

export type NavigationItem = {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  href?: string;
};

type AppShellProps = {
  productName: string;
  productMark: string;
  workspaceLabel: string;
  userName: string;
  userMeta: string;
  navigation: NavigationItem[];
  activeNavigation: string;
  contextLabel?: string;
  onNavigate: (id: string) => void;
  onLogout?: () => void;
  logoutPending?: boolean;
  logoutError?: string | null;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({
  productName,
  productMark,
  workspaceLabel,
  userName,
  userMeta,
  navigation,
  activeNavigation,
  contextLabel,
  onNavigate,
  onLogout,
  logoutPending = false,
  logoutError,
  actions,
  children,
}: AppShellProps) {
  const { mode, toggle } = useContext(ThemeContext);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = () => {
    const shouldRestoreFocus = mobileOpen;
    setMobileOpen(false);
    if (shouldRestoreFocus) {
      window.requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!mobileOpen) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileMenu();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  const navigate = (id: string) => {
    onNavigate(id);
    closeMobileMenu();
  };

  return (
    <div className="mp-shell">
      <aside
        id="mp-sidebar"
        className={`mp-sidebar${mobileOpen ? " is-open" : ""}`}
        aria-label="Основная навигация"
      >
        <div className="mp-brand">
          <span className="mp-brand-mark" aria-hidden="true">
            {productMark}
          </span>
          <span>
            <strong>{productName}</strong>
            <small>{workspaceLabel}</small>
          </span>
          <Button
            ref={closeButtonRef}
            className="mp-mobile-close"
            appearance="subtle"
            icon={<Dismiss24Regular />}
            aria-label="Закрыть меню"
            onClick={closeMobileMenu}
          />
        </div>

        <nav className="mp-navigation">
          {navigation.map((item) => (
            item.href ? <a key={item.id} href={item.href} onClick={closeMobileMenu}>
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? <small>{item.badge}</small> : null}
            </a> :
            <button
              key={item.id}
              type="button"
              className={item.id === activeNavigation ? "is-active" : ""}
              onClick={() => navigate(item.id)}
              aria-current={item.id === activeNavigation ? "page" : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? <small>{item.badge}</small> : null}
            </button>
          ))}
        </nav>

        <div className="mp-sidebar-footer">
          <Avatar name={userName} color="colorful" size={32} />
          <span>
            <strong>{userName}</strong>
            <small>{userMeta}</small>
          </span>
          {onLogout ? (
            <Button
              appearance="subtle"
              icon={<SignOut24Regular />}
              aria-label={logoutPending ? "Выходим…" : "Выйти"}
              title={logoutPending ? "Выходим…" : "Выйти"}
              disabled={logoutPending}
              aria-busy={logoutPending}
              onClick={() => { closeMobileMenu(); onLogout(); }}
            />
          ) : null}
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="mp-backdrop"
          aria-label="Закрыть меню"
          onClick={closeMobileMenu}
        />
      ) : null}

      <div className="mp-workspace">
        <header className="mp-topbar">
          <Button
            ref={menuButtonRef}
            className="mp-menu-button"
            appearance="subtle"
            icon={<Navigation24Regular />}
            aria-label="Открыть меню"
            aria-expanded={mobileOpen}
            aria-controls="mp-sidebar"
            onClick={() => setMobileOpen(true)}
          />
          <span className="mp-topbar-context">
            {contextLabel ?? navigation.find((item) => item.id === activeNavigation)?.label}
          </span>
          <div className="mp-topbar-actions">
            {actions}
            <Tooltip
              content={mode === "light" ? "Тёмная тема" : "Светлая тема"}
              relationship="label"
            >
              <Button
                appearance="subtle"
                icon={
                  mode === "light" ? (
                    <WeatherMoon24Regular />
                  ) : (
                    <WeatherSunny24Regular />
                  )
                }
                onClick={toggle}
              />
            </Tooltip>
          </div>
        </header>
        <main className="mp-content">
          {logoutError ? <div role="alert"><p>{logoutError}</p><Button disabled={logoutPending} onClick={onLogout}>Повторить выход</Button></div> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mp-page-header">
      <div>
        {eyebrow ? <span className="mp-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
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
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
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

export { formatMoney } from "./money";

export function formatDate(
  value: string | Date | null | undefined,
  withTime = false,
) {
  if (!value) return "Нет данных";
  return new Intl.DateTimeFormat(
    "ru-KZ",
    withTime
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" },
  ).format(new Date(value));
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Активно",
  AUTHORIZED: "Авторизовано",
  ARCHIVED: "В архиве",
  ASSEMBLING: "Собирается",
  AWAITING_CONFIRMATION: "Ждёт подтверждения",
  AWAITING_SIGNATURE: "Ждёт подписи",
  BLOCKED: "Заблокировано",
  CANCELLED: "Отменено",
  CALCULATED: "Рассчитано",
  CAPTURED: "Оплачено",
  CLOSED: "Закрыто",
  COMPLETED: "Завершено",
  CONFIRMED: "Подтверждено",
  DEAD: "Исчерпаны попытки",
  DELIVERED: "Доставлено",
  DRAFT: "Черновик",
  EXPIRED: "Истёк срок",
  FAILED: "Ошибка",
  FRESH: "Актуально",
  GENERATED: "Сформировано",
  HIDDEN: "Скрыто",
  IN_PROGRESS: "В работе",
  IN_TRANSIT: "В пути",
  MAPPED: "Сопоставлено",
  MATCHED: "Сопоставлено",
  OPEN: "Открыто",
  PARTIAL: "Частично готово",
  PARTIALLY_FULFILLED: "Частично исполнено",
  PARTIALLY_REFUNDED: "Частичный возврат",
  PAUSED: "Приостановлено",
  PARTIALLY_CONFIRMED: "Частично подтверждено",
  PARTIALLY_DELIVERED: "Доставлено частично",
  PARTIALLY_SIGNED: "Частично подписано",
  PASSED: "Проверка пройдена",
  PENDING: "Ожидает",
  PROCESSING: "Обрабатывается",
  PUBLISHED: "Опубликовано",
  READY: "Готово",
  READY_TO_SHIP: "Готово к отправке",
  RECALLED: "Отозвано",
  RECONCILIATION: "На сверке",
  REJECTED: "Отклонено",
  RESTRICTED: "С ограничениями",
  REVIEW_REQUIRED: "Нужна проверка",
  REVOKED: "Отозвано",
  SENT: "Отправлено",
  SHIPPED: "Отправлено",
  DISPATCHED: "Передано перевозчику",
  PACKING: "Собирается",
  PLANNED: "Запланировано",
  RETURNED: "Возвращено",
  RETURN_DISPUTE: "Спор по возврату",
  SIGNED: "Подписано",
  STALE: "Устарело",
  RUNNING: "Выполняется",
  SUPERSEDED: "Заменено версией",
  UNDER_REVIEW: "На проверке",
  UNKNOWN: "Неизвестно",
  VERIFIED: "Проверено",
};

export function formatStatus(value: string | null | undefined) {
  if (!value) return "Нет статуса";
  return (
    statusLabels[value] ?? value.toLocaleLowerCase("ru").replaceAll("_", " ")
  );
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Произошла неизвестная ошибка";
}
export { useWorkspaceSession } from "./use-workspace-session";

export { OrderWorkflowWorkspace } from "./order-workflow-workspace";
