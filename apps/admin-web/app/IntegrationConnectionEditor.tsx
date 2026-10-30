"use client";

import { Add20Regular } from "@fluentui/react-icons/svg/add";

import { Link20Regular } from "@fluentui/react-icons/svg/link";

import {
  DmButton,
  DmCheckbox,
  DmField,
  DmInput,
  DmSelect,
} from "@marketplace/ui";
import { FormEvent } from "react";

import styles from "./integration-operations.module.css";

type Props = {
  provider: string;
  setProvider: (value: string) => void;
  working: boolean;
  detailsLoading: boolean;
  createConnection: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function IntegrationConnectionEditor({
  provider,
  setProvider,
  working,
  detailsLoading,
  createConnection,
}: Props) {
  return (
    <form
      className={styles.createForm}
      onSubmit={(event) => void createConnection(event)}
    >
      <header>
        <div>
          <h3>Новое подключение</h3>
          <p>Данные для входа будут показаны только один раз.</p>
        </div>
        <Add20Regular />
      </header>
      <DmField label="Система" required>
        <DmSelect
          value={provider}
          onChange={(_, data) => setProvider(data.value)}
          disabled={working || detailsLoading}
        >
          <option value="MOCK">Тестовое подключение</option>
          <option value="MOYSKLAD">МойСклад</option>
          <option value="ONE_C">1С</option>
        </DmSelect>
      </DmField>
      <DmField label="Название" required>
        <DmInput
          name="displayName"
          required
          minLength={2}
          placeholder="Основной склад"
        />
      </DmField>
      {provider === "MOYSKLAD" && (
        <DmField className={styles.full} label="Ключ доступа" required>
          <DmInput
            name="accessToken"
            type="password"
            required
            autoComplete="new-password"
          />
        </DmField>
      )}
      <DmCheckbox
        className={`${styles.check} ${styles.full}`}
        name="enableWebhook"
        label="Получать обновления автоматически"
        disabled={working || detailsLoading}
      />
      <DmButton
        className={styles.full}
        type="submit"
        appearance="primary"
        icon={<Link20Regular />}
        disabled={working || detailsLoading}
      >
        {working ? "Подключаем…" : "Подключить"}
      </DmButton>
    </form>
  );
}
