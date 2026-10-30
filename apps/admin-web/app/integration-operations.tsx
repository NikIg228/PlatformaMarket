"use client";
import { useIntegrationCommands } from "./use-integration-commands";
import { IntegrationSecret } from "./IntegrationSecret";
import { IntegrationConnectionEditor } from "./IntegrationConnectionEditor";
import { IntegrationConnectionList } from "./IntegrationConnectionList";
import { IntegrationControls } from "./IntegrationControls";
import { IntegrationActivity } from "./IntegrationActivity";

import { Key20Regular } from "@fluentui/react-icons/svg/key";

import {
  DmButton,
  DmFeedback,
  DmField,
  DmSelect,
  LoadingState,
} from "@marketplace/ui";
import { useState } from "react";
import { formatAdminStatus } from "./admin-labels";
import styles from "./integration-operations.module.css";

import {
  dataTypeLabels,
  providerLabel,
  dateTime,
} from "./integration-operations-format";
import { useIntegrationReads } from "./use-integration-reads";

export function IntegrationOperations() {
  const {
    suppliers,
    supplierId,
    setSupplierId,
    connections,
    warehouses,
    offers,
    connectionId,
    setConnectionId,
    jobs,
    reconciliation,
    loading,
    detailsLoading,
    message,
    setMessage,
    messageTone,
    setMessageTone,
    request,
    load,
    loadSupplier,
    loadDetails,
    selected,
    counts,
  } = useIntegrationReads();

  const [provider, setProvider] = useState("MOCK");

  const [mappingType, setMappingType] = useState<"WAREHOUSE" | "VARIANT">(
    "WAREHOUSE",
  );
  const {
    working,
    oneTimeSecret,
    setOneTimeSecret,
    createConnection,
    createBinding,
    upsertMapping,
    enqueueJob,
    changeStatus,
    rotateEnrollment,
  } = useIntegrationCommands({
    supplierId,
    connectionId,
    selected,
    loadSupplier,
    request,
    setMessage,
    setMessageTone,
    provider,
    mappingType,
  });

  return (
    <section
      id="integration-operations"
      className={styles.section}
      aria-label="Загрузка товаров поставщика"
    >
      <div className={styles.heading}>
        <div>
          <h2>Подключение учётных систем</h2>
          <p>Подключайте МойСклад или 1С и проверяйте обновление товаров.</p>
        </div>
        <div className={styles.toolbar}>
          <DmField label="Поставщик">
            <DmSelect
              value={supplierId}
              onChange={(_, data) => {
                const id = data.value;
                setSupplierId(id);
                setOneTimeSecret(null);
                setMessage("");
                void loadSupplier(id).catch(() => {
                  /* loadSupplier renders current failures. */
                });
              }}
              disabled={loading || working}
            >
              {suppliers.map((supplier) => (
                <option
                  key={supplier.organizationId}
                  value={supplier.organizationId}
                >
                  {supplier.organization.displayName}
                </option>
              ))}
            </DmSelect>
          </DmField>
        </div>
      </div>

      {message ? (
        <DmFeedback
          tone={messageTone}
          title={
            messageTone === "danger"
              ? "Операция не выполнена"
              : "Операция выполнена"
          }
          description={message}
          alert={messageTone === "danger"}
          action={
            messageTone === "danger" ? (
              <DmButton onClick={() => void load()}>
                Повторить загрузку
              </DmButton>
            ) : undefined
          }
        />
      ) : null}
      {oneTimeSecret && (
        <IntegrationSecret
          oneTimeSecret={oneTimeSecret}
          setOneTimeSecret={setOneTimeSecret}
        />
      )}

      {loading ? (
        <LoadingState label="Загружаем подключения" />
      ) : (
        <>
          <div className={styles.metrics}>
            <div>
              <span>Активные</span>
              <strong>{counts.active}</strong>
            </div>
            <div>
              <span>В очереди</span>
              <strong>{counts.queued}</strong>
            </div>
            <div>
              <span>С ошибкой</span>
              <strong>{counts.dead}</strong>
            </div>
            <div>
              <span>Расхождения</span>
              <strong>{counts.mismatches}</strong>
            </div>
          </div>
          <div className={styles.layout}>
            <div className={styles.connectionPane}>
              <IntegrationConnectionEditor
                provider={provider}
                setProvider={setProvider}
                working={working}
                detailsLoading={detailsLoading}
                createConnection={createConnection}
              />

              <IntegrationConnectionList
                connections={connections}
                connectionId={connectionId}
                setConnectionId={setConnectionId}
                setMessage={setMessage}
                loadDetails={loadDetails}
                supplierId={supplierId}
                working={working}
              />
            </div>

            <div className={styles.detailPane}>
              {!selected ? (
                <div className={styles.empty}>
                  Выберите подключение для управления.
                </div>
              ) : (
                <>
                  <header className={styles.detailHeader}>
                    <div>
                      <h3>{selected.displayName}</h3>
                      <p>
                        {providerLabel(selected.provider)}. Последний успех:{" "}
                        {dateTime(selected.lastSuccessAt)}
                      </p>
                    </div>
                    <div className={styles.statusActions}>
                      {selected.status === "PAUSED" ? (
                        <DmButton
                          appearance="primary"
                          onClick={() => void changeStatus("ACTIVE")}
                          disabled={working || detailsLoading}
                        >
                          Возобновить
                        </DmButton>
                      ) : (
                        selected.status !== "REVOKED" && (
                          <DmButton
                            appearance="secondary"
                            onClick={() => void changeStatus("PAUSED")}
                            disabled={working || detailsLoading}
                          >
                            Пауза
                          </DmButton>
                        )
                      )}
                      {selected.status !== "REVOKED" && (
                        <DmButton
                          appearance="subtle"
                          onClick={() => void changeStatus("REVOKED")}
                          disabled={working || detailsLoading}
                        >
                          Отозвать
                        </DmButton>
                      )}
                    </div>
                  </header>
                  {selected.lastError && (
                    <div className={styles.error}>
                      <strong>Последняя ошибка</strong>
                      <span>{selected.lastError}</span>
                    </div>
                  )}
                  {selected.agent && (
                    <div className={styles.agent}>
                      <span>
                        <strong>1С</strong>
                        <small>{selected.agent.agentId}</small>
                      </span>
                      <span>
                        <b>{formatAdminStatus(selected.agent.status)}</b>
                        <small>
                          Последняя связь:{" "}
                          {dateTime(selected.agent.lastHeartbeatAt)}
                        </small>
                      </span>
                      <DmButton
                        icon={<Key20Regular />}
                        appearance="secondary"
                        onClick={() => void rotateEnrollment()}
                        disabled={working || detailsLoading}
                      >
                        Новый ключ
                      </DmButton>
                    </div>
                  )}

                  <IntegrationControls
                    working={working}
                    detailsLoading={detailsLoading}
                    mappingType={mappingType}
                    setMappingType={setMappingType}
                    warehouses={warehouses}
                    offers={offers}
                    createBinding={createBinding}
                    enqueueJob={enqueueJob}
                    upsertMapping={upsertMapping}
                  />

                  <section className={styles.bindings}>
                    <header>
                      <h4>Какие данные обновлять</h4>
                      <span>{selected.bindings.length}</span>
                    </header>
                    {selected.bindings.length === 0 ? (
                      <div className={styles.empty}>
                        Выберите данные, которые нужно обновлять.
                      </div>
                    ) : (
                      <div>
                        {selected.bindings.map((binding) => (
                          <span key={binding.id}>
                            <b>
                              {dataTypeLabels[binding.dataType] ??
                                binding.dataType}
                            </b>
                            <small>приоритет {binding.priority}</small>
                          </span>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className={styles.bindings}>
                    <header>
                      <h4>Связанные записи</h4>
                      <span>{selected.mappings.length}</span>
                    </header>
                    {selected.mappings.length === 0 ? (
                      <div className={styles.empty}>
                        Связанных записей пока нет. Они нужны, если названия
                        складов или товаров различаются.
                      </div>
                    ) : (
                      <div>
                        {selected.mappings.map((mapping) => (
                          <span key={mapping.id}>
                            <b>{mapping.entityType}</b>
                            <small>
                              {mapping.externalId} →{" "}
                              {mapping.internalId?.slice(0, 8) ?? "данные"}
                            </small>
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  <IntegrationActivity
                    jobs={jobs}
                    reconciliation={reconciliation}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
