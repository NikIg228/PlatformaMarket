import {
  DmButton,
  StatusTag,
  productWorkflowStyles as styles,
  formatDate,
} from "@marketplace/ui";

import type { Correction } from "./product-corrections-panel-types";

import type { Dispatch, SetStateAction } from "react";

type Props = {
  filtered: Correction[];
  historyLimit: number;
  selectedId: string | null;
  fieldLabel: (field: string) => string;
  statusLabel: Record<
    "PENDING" | "REJECTED" | "APPROVED" | "PARTIALLY_APPROVED",
    string
  >;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
};

export function ProductCorrectionsTable({
  filtered,
  historyLimit,
  selectedId,
  fieldLabel,
  statusLabel,
  setSelectedId,
}: Props) {
  return (
    <table className={styles.table}>
      <caption className="dm-sr-only">Мои исправления</caption>
      <thead>
        <tr>
          <th>Товар и поле</th>
          <th>Дата</th>
          <th>Статус</th>
          <th>Действие</th>
        </tr>
      </thead>
      <tbody>
        {filtered.slice(0, historyLimit).map((item) => (
          <tr key={item.id} data-selected={selectedId === item.id}>
            <td data-label="Товар">
              <div>
                <strong>{item.product.canonicalName}</strong>
                <small>{fieldLabel(item.field)}</small>
              </div>
            </td>
            <td data-label="Дата">
              <div>{formatDate(item.createdAt, true)}</div>
            </td>
            <td data-label="Статус">
              <div>
                <StatusTag
                  tone={
                    item.status === "REJECTED"
                      ? "danger"
                      : item.status === "PENDING"
                        ? "warning"
                        : "success"
                  }
                >
                  {statusLabel[item.status]}
                </StatusTag>
              </div>
            </td>
            <td data-label="Действие">
              <DmButton onClick={() => setSelectedId(item.id)}>
                Подробнее
              </DmButton>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
