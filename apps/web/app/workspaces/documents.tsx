"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DocumentArchiveItem,
  DocumentArchiveQueryInput,
  DocumentArchiveSummaryResponse,
} from "@marketplace/api-client";
import {
  DocumentArchiveUpload,
  DocumentArchiveWorkspace,
  documentOrderOptions,
  documentAgreementOptions,
  documentArchiveDateRange,
  DOCUMENT_ARCHIVE_TIME_ZONE,
  type DocumentArchiveFilters,
  type DocumentArchiveUploadInput,
} from "@marketplace/ui";
import { SupplierTermsPanel } from "../../../supplier-web/app/supplier-terms-panel";
import { useWorkspace } from "./workspace";
import styles from "./workspace.module.css";
import { Credentials } from "./credentials";
import { ResourceStatus } from "./resource-status";
import { PermissionBoundary } from "./permission-boundary";

const initial: DocumentArchiveFilters = {
  q: "",
  category: "",
  status: "",
  accountingStatus: "",
  dateFrom: "",
  dateTo: "",
};
export default function Documents() {
  const { api, apiContext, role, organizationId } = useWorkspace();
  const [items, setItems] = useState<DocumentArchiveItem[]>([]);
  const [summary, setSummary] = useState<DocumentArchiveSummaryResponse | null>(
    null,
  );
  const [filters, setFilters] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [legalOpen, setLegalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const sequence = useRef(0);
  const moreLock = useRef(false);
  const inFlight = useRef(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const load = useCallback(
    async (after?: string, background = false) => {
      if (inFlight.current) return;
      if (!navigator.onLine) { setOffline(true); setLoading(false); return; }
      inFlight.current = true;
      const request = ++sequence.current;
      setLoading(true);
      setRefreshError(null);
      if (!background) setError(null);
      const query: DocumentArchiveQueryInput = {
        q: applied.q || undefined,
        category: (applied.category ||
          undefined) as DocumentArchiveQueryInput["category"],
        status: (applied.status ||
          undefined) as DocumentArchiveQueryInput["status"],
        accountingStatus: (applied.accountingStatus ||
          undefined) as DocumentArchiveQueryInput["accountingStatus"],
        ...documentArchiveDateRange(applied.dateFrom, applied.dateTo),
        cursor: after,
        limit: 25,
      };
      try {
        const [page, totals] = await Promise.all([
          api.listDocumentArchive(query),
          api.getDocumentArchiveSummary(),
        ]);
        if (request !== sequence.current) return;
        setItems((current) =>
          after
            ? [
                ...new Map(
                  [...current, ...page.items].map((item) => [item.id, item]),
                ).values(),
              ]
            : page.items,
        );
        setCursor(page.nextCursor);
        setSummary(totals);
        setLastSuccessAt(Date.now());
      } catch (cause) {
        if (request === sequence.current)
          setRefreshError(
            cause instanceof Error
              ? cause.message
              : "Не удалось загрузить документы",
          );
      } finally {
        if (request === sequence.current) { setLoading(false); inFlight.current = false; }
      }
    },
    [api, applied, organizationId],
  );
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
      inFlight.current = false;
    };
  }, [load]);
  useEffect(() => {
    const wake = () => {
      setOffline(!navigator.onLine);
      if (document.visibilityState === "visible") void load(undefined, true);
    };
    const disconnect = () => setOffline(true);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("offline", disconnect);
    return () => {
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", disconnect);
    };
  }, [load]);
  const loadOrders = useCallback(
    async (query: string) =>
      documentOrderOptions(
        await (role === "clinic"
          ? api.listBuyerOrders(organizationId)
          : api.listSupplierOrders()),
        organizationId,
        query,
      ),
    [api, role, organizationId],
  );
  const loadAgreements = useCallback(
    async (query: string) => {
      const page = await api.listDocumentArchive({
        category: "CONTRACT",
        q: query || undefined,
        limit: 100,
      });
      return documentAgreementOptions(
        page.items,
        organizationId,
        page.nextCursor !== null,
      );
    },
    [api, organizationId],
  );
  const download = async (item: DocumentArchiveItem) => {
    setBusyId(item.id);
    setError(null);
    try {
      const result = await api.downloadDocument(item.id);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        result.fileName ?? item.fileName ?? item.documentNumber ?? "document";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Не удалось скачать документ",
      );
    } finally {
      setBusyId(null);
    }
  };
  const upload = async (input: DocumentArchiveUploadInput) => {
    setUploading(true);
    try {
      await api.uploadDocument({
        ...input,
        ownerOrganizationId: organizationId,
        kind: input.kind as Parameters<typeof api.uploadDocument>[0]["kind"],
      });
      await load();
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className={styles.stack}>
      {role === "supplier" ? (
        <details
          className={styles.panel}
          onToggle={(event) => setLegalOpen(event.currentTarget.open)}
        >
          <summary>Договор и документы организации</summary>
          {legalOpen ? (
            <div className={styles.stack}>
              <SupplierTermsPanel apiContext={apiContext} />
              <PermissionBoundary required={["compliance.view"]}><Credentials /></PermissionBoundary>
            </div>
          ) : null}
        </details>
      ) : null}
      <ResourceStatus resource={{ lastSuccessAt, offline, refreshing: loading, error: refreshError }} />
      <DocumentArchiveWorkspace
        roleLabel={role === "clinic" ? "клиника" : "поставщик"}
        organizationId={organizationId}
        items={items}
        summary={summary}
        filters={filters}
        calendarTimeZone={DOCUMENT_ARCHIVE_TIME_ZONE}
        filterError={filterError}
        nextCursor={cursor}
        loading={loading}
        error={error ?? (!lastSuccessAt ? refreshError ?? (offline ? "Нет подключения к сети" : null) : null)}
        busyDocumentId={busyId}
        uploadAction={
          <DocumentArchiveUpload
            key={organizationId}
            kinds={
              role === "clinic"
                ? [
                    "PAYMENT_CONFIRMATION",
                    "CONTRACT_ADDENDUM",
                    "ACCEPTANCE_ACT",
                    "OTHER",
                  ]
                : [
                    "INVOICE",
                    "WAYBILL",
                    "ACCEPTANCE_ACT",
                    "CONTRACT_ADDENDUM",
                    "OTHER",
                  ]
            }
            busy={uploading}
            onUpload={upload}
            loadOrderOptions={loadOrders}
            loadAgreementOptions={loadAgreements}
          />
        }
        onFiltersChange={next => { setFilters(next); setFilterError(null); }}
        onApplyFilters={() => {
          try { documentArchiveDateRange(filters.dateFrom, filters.dateTo); setFilterError(null); setApplied({ ...filters }); }
          catch (cause) { setFilterError(cause instanceof Error ? cause.message : "Проверьте даты периода."); }
        }}
        onResetFilters={() => {
          setFilters(initial);
          setFilterError(null);
          setApplied({ ...initial });
        }}
        onRefresh={() => void load()}
        onLoadMore={() => {
          if (!cursor || moreLock.current || loading) return;
          moreLock.current = true;
          void load(cursor).finally(() => {
            moreLock.current = false;
          });
        }}
        onDownload={(item) => void download(item as DocumentArchiveItem)}
        onOpenDocument={(id) => api.getArchiveDocument(id)}
        onAccountingStatus={async (item, status, reason) => {
          setBusyId(item.id);
          try {
            const updated = await api.updateDocumentAccountingStatus(item.id, {
              status,
              reason,
              expectedUpdatedAt: item.updatedAt,
            });
            setItems((current) =>
              current.map((row) => (row.id === updated.id ? updated : row)),
            );
            setSummary(await api.getDocumentArchiveSummary());
          } finally {
            setBusyId(null);
          }
        }}
      />
    </div>
  );
}
