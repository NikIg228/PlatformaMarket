"use client";
import { DmButton, DmFeedback, DmField, DmSelect } from "@marketplace/ui";
import type { WorkspaceChoice } from "../auth-client";
import styles from "./workspace-choice.module.css";

export function LoginWorkspaceChoice({ choices, selected, unavailable, busy, onSelect, onContinue, onSwitchAccount }: {
  choices: WorkspaceChoice[];
  selected: number;
  unavailable: boolean;
  busy: boolean;
  onSelect: (index: number) => void;
  onContinue: () => void;
  onSwitchAccount: () => void;
}) {
  return <div className={styles.content} aria-busy={busy}>
    {unavailable ? <DmFeedback tone="warning" title="Нет доступа к запрошенному кабинету"
      description="Для этого аккаунта кабинет недоступен. Вернитесь в доступный кабинет или войдите другим аккаунтом." alert /> : null}
    {!unavailable && choices.length > 0 ? <DmField label="Организация и кабинет">
      <DmSelect value={String(selected)} disabled={busy} onChange={(_, data) => onSelect(Number(data.value))}>
        {choices.map((item, index) => <option key={`${item.organizationId}:${item.capability}`} value={index}>
          {item.organizationDisplayName} · {item.capability === "BUYER" ? "Клиника" : "Поставщик"}
        </option>)}
      </DmSelect>
    </DmField> : null}
    {choices.length > 0 ? <DmButton appearance="primary" disabled={busy} onClick={onContinue}>
      {busy ? "Открываем кабинет…" : unavailable ? "Вернуться в доступный кабинет" : "Открыть выбранную организацию"}
    </DmButton> : null}
    <DmButton disabled={busy} onClick={onSwitchAccount}>Войти другим аккаунтом</DmButton>
  </div>;
}
