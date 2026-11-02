"use client";

import { Key20Regular } from "@fluentui/react-icons/svg/key";

import { DmButton, DmFeedback } from "@marketplace/ui";


type Props = {
  oneTimeSecret: { title: string; lines: string[] };
  setOneTimeSecret: (value: null) => void;
};

export function IntegrationSecret({ oneTimeSecret, setOneTimeSecret }: Props) {
  return (
    <DmFeedback presentation="inline" tone="warning" alert icon={<Key20Regular />}
      title={oneTimeSecret.title} description="Сохраните данные подключения в безопасном месте. Они показываются один раз."
      details={oneTimeSecret.lines.map(line => <div key={line}><code>{line}</code></div>)}
      action={<DmButton
        appearance="subtle"
        aria-label="Закрыть данные подключения"
        onClick={() => setOneTimeSecret(null)}
      >
        Закрыть
      </DmButton>} />
  );
}
