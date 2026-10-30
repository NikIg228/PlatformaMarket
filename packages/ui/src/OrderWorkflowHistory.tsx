import type { OrderWorkflowResponse } from "@marketplace/schemas";

import { Section } from "./primitives";
import { formatDate } from "./format";

type Props = {
  data: OrderWorkflowResponse;
  labels: Record<string, string>;
};

export function OrderWorkflowHistory({ data, labels }: Props) {
  return (
    <Section title="История действий">
      {data.events.length ? (
        <ol>
          {data.events.map((event) => (
            <li key={event.id}>
              {formatDate(event.createdAt, true)} —{" "}
              {labels[event.action] ?? "Состояние заказа обновлено"}
              {typeof event.details.comment === "string" &&
              event.details.comment
                ? `: ${event.details.comment}`
                : ""}
              {typeof event.details.reason === "string"
                ? `: ${event.details.reason}`
                : ""}
            </li>
          ))}
        </ol>
      ) : (
        <p>Действий по оплате пока нет.</p>
      )}
    </Section>
  );
}
