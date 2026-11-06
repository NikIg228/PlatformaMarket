import { DmButton } from "./actions";
import { DmFeedback } from "./primitives";

export function OrderWorkflowFeedback({ error, notice, recovery, busy, canRecover, retry, refresh }: {
  error: string;
  notice: string;
  recovery: boolean;
  busy: boolean;
  canRecover: boolean;
  retry: () => void;
  refresh: () => void;
}) {
  return <>
    {recovery ? <DmFeedback
      tone="warning"
      title="Результат действия пока не подтверждён"
      description={canRecover
        ? "Запрос мог быть выполнен. Восстановите результат с прежними данными перед следующим действием."
        : "Для восстановления результата нужны права на исходное действие. Обратитесь к администратору организации."}
      action={<DmButton disabled={busy || !canRecover} onClick={retry}>
        {busy ? "Восстанавливаем результат…" : "Восстановить результат"}
      </DmButton>}
    /> : error ? <DmFeedback
      tone="danger"
      title="Требуется внимание"
      description={error}
      action={<DmButton disabled={busy} onClick={refresh}>Повторить загрузку</DmButton>}
    /> : null}
    {notice ? <DmFeedback tone="success" title="Готово" description={notice} /> : null}
  </>;
}
