import type {
  MarketplaceApiClient,
  SupplierImportBatchResponse,
  SupplierImportDiagnosticsResponse,
} from "@marketplace/api-client";

import {
  DmButton,
  DmTable,
  ErrorState,
  LoadingState,
  StatusTag,
  productWorkflowStyles as styles,
  formatStatus,
  formatDate,
} from "@marketplace/ui";

import type { Dispatch, SetStateAction, RefObject } from "react";

type Props = {
  historyError: string | null;
  loadHistory: (cursor?: string | undefined) => Promise<void>;
  history: SupplierImportBatchResponse[] | null;
  historyLoading: boolean;
  setTab: Dispatch<SetStateAction<"new" | "history">>;
  busy: boolean;
  file: File | null;
  batch: SupplierImportBatchResponse | null;
  run: (action: () => Promise<void>) => Promise<void>;
  api: MarketplaceApiClient;
  supplierId: string;
  setBatch: Dispatch<SetStateAction<SupplierImportBatchResponse | null>>;
  batchId: RefObject<string | null>;
  setDiagnostics: Dispatch<
    SetStateAction<SupplierImportDiagnosticsResponse | null>
  >;
  setReason: Dispatch<SetStateAction<string>>;
  setStep: Dispatch<SetStateAction<number>>;
  historyHasMore: boolean;
};

export function SpreadsheetImportHistory({
  historyError,
  loadHistory,
  history,
  historyLoading,
  setTab,
  busy,
  file,
  batch,
  run,
  api,
  supplierId,
  setBatch,
  batchId,
  setDiagnostics,
  setReason,
  setStep,
  historyHasMore,
}: Props) {
  return (
    <section
      className={`${styles.panel} ${styles.form}`}
      aria-label="История загрузок"
    >
      <div className={styles.toolbar}>
        <h2>История загрузок</h2>
      </div>
      {historyError ? (
        <ErrorState
          description={historyError}
          action={
            <DmButton onClick={() => void loadHistory()}>Повторить</DmButton>
          }
        />
      ) : null}
      {!history && historyLoading ? (
        <LoadingState label="Загружаем историю" />
      ) : null}
      {history?.length === 0 ? (
        <div className={styles.empty}>
          <h2>Загрузок пока нет</h2>
          <p>Загрузите первый прайс в формате CSV или Excel.</p>
          <DmButton appearance="primary" onClick={() => setTab("new")}>
            Загрузить файл
          </DmButton>
        </div>
      ) : history ? (
        <DmTable
          caption="История импорта"
          columns={[
            { key: "file", label: "Файл" },
            { key: "date", label: "Дата" },
            { key: "status", label: "Результат" },
            { key: "action", label: "Действие" },
          ]}
        >
          {history.map((item) => (
            <tr key={item.id}>
              <td data-label="Файл">
                <div>
                  <strong>{item.fileName}</strong>
                </div>
              </td>
              <td data-label="Дата">
                <div>{formatDate(item.createdAt, true)}</div>
              </td>
              <td data-label="Результат">
                <div>
                  <StatusTag>{formatStatus(item.status)}</StatusTag>
                  <small>
                    Обработано {item.processedRows}/{item.totalRows} · ошибок{" "}
                    {item.errorRows}
                  </small>
                </div>
              </td>
              <td data-label="Действие">
                <div>
                  <DmButton
                    disabled={busy}
                    onClick={() => {
                      if (
                        file &&
                        !batch &&
                        !window.confirm(
                          "Открыть прошлую загрузку и закрыть текущий предпросмотр?",
                        )
                      )
                        return;
                      void run(async () => {
                        const [detail, report] = await Promise.all([
                          api.getSupplierImportBatch(supplierId, item.id),
                          api.getSupplierImportDiagnostics(supplierId, item.id),
                        ]);
                        setBatch(detail);
                        batchId.current = detail.id;
                        setDiagnostics(report);
                        setReason("");
                        setTab("new");
                        setStep(3);
                      });
                    }}
                  >
                    Открыть результат {item.fileName}
                  </DmButton>
                </div>
              </td>
            </tr>
          ))}
        </DmTable>
      ) : null}
      {historyHasMore ? (
        <DmButton
          disabled={historyLoading}
          onClick={() => void loadHistory(history?.at(-1)?.id)}
        >
          Показать более ранние загрузки
        </DmButton>
      ) : null}
    </section>
  );
}
