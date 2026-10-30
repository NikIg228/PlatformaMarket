"use client";
import { DmAction } from "@marketplace/ui/controls";

import { StatusTag } from "@marketplace/ui";

import { formatAdminStatus } from "./admin-labels";
import styles from "./integration-operations.module.css";

import { providerLabel } from "./integration-operations-format";

import type { Connection } from "./integration-operations-types";

type Props = {
  connections: Connection[];
  connectionId: string;
  setConnectionId: (id: string) => void;
  setMessage: (value: string) => void;
  loadDetails: (supplier: string, connection: string) => Promise<void>;
  supplierId: string;
};

export function IntegrationConnectionList({
  connections,
  connectionId,
  setConnectionId,
  setMessage,
  loadDetails,
  supplierId,
}: Props) {
  return (
    <div className={styles.connectionList}>
      <header>
        <h3>Подключения</h3>
        <span>{connections.length}</span>
      </header>
      {connections.length === 0 ? (
        <div className={styles.empty}>
          Подключений пока нет. Добавьте учётную систему.
        </div>
      ) : (
        connections.map((connection) => (
          <DmAction
            variant="row"

            key={connection.id}
            aria-pressed={connection.id === connectionId}
            onClick={() => {
              setConnectionId(connection.id);
              setMessage("");
              void loadDetails(supplierId, connection.id).catch(() => {
                /* loadDetails renders current failures. */
              });
            }}
          >
            <span>
              <strong>{connection.displayName}</strong>
              <small>
                {providerLabel(connection.provider)} / {connection.mode}
              </small>
            </span>
            <StatusTag
              tone={
                connection.status === "ACTIVE"
                  ? "success"
                  : connection.status === "ERROR"
                    ? "danger"
                    : "neutral"
              }
            >
              {formatAdminStatus(connection.status)}
            </StatusTag>
          </DmAction>
        ))
      )}
    </div>
  );
}
