"use client";

import { Key20Regular } from "@fluentui/react-icons/svg/key";

import { DmButton } from "@marketplace/ui";

import styles from "./integration-operations.module.css";

type Props = {
  oneTimeSecret: { title: string; lines: string[] };
  setOneTimeSecret: (value: null) => void;
};

export function IntegrationSecret({ oneTimeSecret, setOneTimeSecret }: Props) {
  return (
    <div className={styles.secret} role="alert">
      <Key20Regular />
      <div>
        <strong>{oneTimeSecret.title}</strong>
        {oneTimeSecret.lines.map((line) => (
          <code key={line}>{line}</code>
        ))}
      </div>
      <DmButton
        appearance="subtle"
        aria-label="Закрыть данные подключения"
        onClick={() => setOneTimeSecret(null)}
      >
        Закрыть
      </DmButton>
    </div>
  );
}
