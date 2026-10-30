import { DmCheckbox } from "./controls";

import { DmButton } from "./actions";
import { DmField, DmInput } from "./controls";
import { Section } from "./primitives";

import { type WorkflowAction as Action } from "./order-workflow-command";

import type { Dispatch, SetStateAction } from "react";

type Props = {
  comment: string;
  setComment: Dispatch<SetStateAction<string>>;
  noTransfer: boolean;
  setNoTransfer: Dispatch<SetStateAction<boolean>>;
  busy: boolean;
  canAct: (action: Action["action"]) => boolean;
  perform: (action: Action) => Promise<void>;
};

export function OrderCancellationForm({
  comment,
  setComment,
  noTransfer,
  setNoTransfer,
  busy,
  canAct,
  perform,
}: Props) {
  return (
    <Section title="Отмена до оплаты">
      <DmField label="Причина отмены">
        <DmInput value={comment} onChange={(_, d) => setComment(d.value)} />
      </DmField>
      <DmCheckbox
        checked={noTransfer}
        onChange={(e) => setNoTransfer(e.target.checked)}
        label="Перевод по этому заказу не выполнялся"
      />
      <DmButton
        disabled={
          busy || !canAct("CANCEL") || !noTransfer || comment.trim().length < 3
        }
        onClick={() =>
          void perform({
            action: "CANCEL",
            reason: comment,
            transferNotMade: true,
          })
        }
      >
        Отменить заказ
      </DmButton>
    </Section>
  );
}
