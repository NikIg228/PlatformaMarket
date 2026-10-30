"use client";
import { DocumentArchiveDetail } from "./DocumentArchiveDetail";
import { DocumentArchiveTable } from "./DocumentArchiveTable";
import { DocumentArchiveFilterForm } from "./DocumentArchiveFilterForm";

import { ActionFeedback } from "./action-feedback";

import { Spinner } from "@fluentui/react-components";
import { DmButton as Button, DmSurface } from "./controls";

import { Document24Regular } from "@fluentui/react-icons/svg/document";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { usePermissions } from "./permissions";
import type {
  DocumentArchiveItemView,
  DocumentArchiveSummaryView,
  DocumentArchiveFilters,
} from "./document-archive-types";
import {
  categoryLabels,
  kindLabels,
  statusLabels,
  formatDate,
  DocumentStatus,
} from "./document-archive-presentation";

export function DocumentArchiveWorkspace({
  initialDocumentId,
  hideHeading = false,
  roleLabel,
  organizationId,
  items,
  summary,
  filters,
  nextCursor,
  loading,
  error,
  busyDocumentId,
  uploadAction,
  onFiltersChange,
  onApplyFilters,
  onResetFilters,
  onRefresh,
  onLoadMore,
  onDownload,
  onOpenDocument,
  onAccountingStatus,
  calendarTimeZone,
  filterError,
}: {
  initialDocumentId?: string | null;
  hideHeading?: boolean;
  roleLabel: string;
  organizationId: string;
  items: DocumentArchiveItemView[];
  summary: DocumentArchiveSummaryView | null;
  filters: DocumentArchiveFilters;
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
  busyDocumentId: string | null;
  uploadAction?: ReactNode;
  onFiltersChange: (next: DocumentArchiveFilters) => void;
  onApplyFilters: (next: DocumentArchiveFilters) => void;
  onResetFilters: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onDownload: (document: DocumentArchiveItemView) => void;
  onOpenDocument: (documentId: string) => Promise<DocumentArchiveItemView>;
  onAccountingStatus?: (
    document: DocumentArchiveItemView,
    status: "REVIEWED" | "RECONCILED" | "DISPUTED",
    reason: string,
  ) => Promise<void>;
  calendarTimeZone?: string;
  filterError?: string | null;
}) {
  const has = usePermissions();
  const [searchDraft, setSearchDraft] = useState(filters.q);
  useEffect(() => setSearchDraft(filters.q), [filters.q]);
  const showDate = (value: string) => formatDate(value, calendarTimeZone);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDocumentId ?? null,
  );
  const documentDialog = useRef<HTMLDivElement>(null);
  const openDocumentRef = useRef(onOpenDocument);
  openDocumentRef.current = onOpenDocument;
  const [selectedDetail, setSelectedDetail] =
    useState<DocumentArchiveItemView | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [accountingStatus, setAccountingStatus] = useState<
    "REVIEWED" | "RECONCILED" | "DISPUTED"
  >("REVIEWED");
  const [accountingReason, setAccountingReason] = useState("");
  useEffect(() => {
    // A retry replaces its button with loading/content. Keep keyboard events in the open dialog.
    if (
      selectedId &&
      documentDialog.current &&
      !documentDialog.current.contains(document.activeElement)
    )
      documentDialog.current.focus();
  }, [selectedId, selectedDetail, detailFailed]);
  useEffect(() => {
    if (!initialDocumentId) return;
    let active = true;
    setSelectedId(initialDocumentId);
    setSelectedDetail(null);
    setDetailFailed(false);
    void openDocumentRef
      .current(initialDocumentId)
      .then((value) => {
        if (active) setSelectedDetail(value);
      })
      .catch(() => {
        if (active) setDetailFailed(true);
      });
    return () => {
      active = false;
    };
  }, [initialDocumentId, organizationId]);
  const selected = useMemo(
    () =>
      selectedDetail?.id === selectedId
        ? selectedDetail
        : (items.find(({ id }) => id === selectedId) ?? null),
    [items, selectedDetail, selectedId],
  );
  const counterparties =
    selected?.participants.filter(
      ({ organizationId: participantId }) => participantId !== organizationId,
    ) ?? [];
  const openDocument = (documentId: string) => {
    setSelectedId(documentId);
    setSelectedDetail(null);
    setDetailFailed(false);
    void onOpenDocument(documentId)
      .then(setSelectedDetail)
      .catch(() => setDetailFailed(true));
  };

  return (
    <div className="dm-document-archive">
      <header className="dm-document-archive-header">
        {!hideHeading ? (
          <div>
            <span className="dm-document-archive-eyebrow">
              Документолог · {roleLabel}
            </span>
            <h1>Документы</h1>
            <p>
              Договоры, счета, подтверждения оплаты и отгрузочные документы в
              одном защищённом архиве.
            </p>
          </div>
        ) : null}
        <div className="dm-document-archive-actions">{uploadAction}</div>
      </header>

      <div className="dm-document-summary" aria-label="Сводка по архиву">
        {[
          ["Всего документов", summary?.total ?? 0],
          ["Ожидают подписи", summary?.awaitingSignature ?? 0],
          ["Требуют внимания", summary?.attention ?? 0],
          ["За этот месяц", summary?.thisMonth ?? 0],
        ].map(([label, value]) => (
          <DmSurface className="dm-document-summary-card" key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </DmSurface>
        ))}
      </div>

      {calendarTimeZone ? (
        <p>Даты в часовом поясе: {calendarTimeZone}.</p>
      ) : null}
      <DocumentArchiveFilterForm
        filters={filters}
        searchDraft={searchDraft}
        onFiltersChange={onFiltersChange}
        onApplyFilters={onApplyFilters}
        setSearchDraft={setSearchDraft}
        onResetFilters={onResetFilters}
      />
      {filterError ? <p role="alert">{filterError}</p> : null}

      {error ? (
        <ActionFeedback
          tone="error"
          title="Архив не загрузился"
          description={error}
          action={<Button onClick={onRefresh}>Повторить</Button>}
        />
      ) : null}
      {loading && !items.length ? (
        <div className="dm-document-loading">
          <Spinner label="Загружаем документы" />
        </div>
      ) : null}
      {!loading && !error && !items.length ? (
        <div className="dm-document-empty">
          <Document24Regular />
          <h2>Документов пока нет</h2>
          <p>
            После оформления заказа, загрузки файла или заключения договора
            документы появятся здесь.
          </p>
        </div>
      ) : null}

      {items.length ? (
        <DocumentArchiveTable
          items={items}
          organizationId={organizationId}
          openDocument={openDocument}
          showDate={showDate}
          busyDocumentId={busyDocumentId}
          onDownload={onDownload}
        />
      ) : null}
      {nextCursor ? (
        <div className="dm-document-load-more">
          <Button onClick={onLoadMore} disabled={loading}>
            {loading ? "Загружаем…" : "Показать ещё"}
          </Button>
        </div>
      ) : null}

      <DocumentArchiveDetail
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        documentDialog={documentDialog}
        selected={selected}
        showDate={showDate}
        counterparties={counterparties}
        detailFailed={detailFailed}
        onAccountingStatus={onAccountingStatus}
        accountingStatus={accountingStatus}
        setAccountingStatus={setAccountingStatus}
        accountingReason={accountingReason}
        setAccountingReason={setAccountingReason}
        has={has}
        busyDocumentId={busyDocumentId}
        openDocument={openDocument}
        onDownload={onDownload}
      />
    </div>
  );
}

export type {
  DocumentArchiveParticipantView,
  DocumentArchiveItemView,
  DocumentArchiveSummaryView,
  DocumentArchiveFilters,
  DocumentArchiveUploadInput,
} from "./document-archive-types";
export {
  categoryLabels,
  kindLabels,
  statusLabels,
  DocumentStatus,
} from "./document-archive-presentation";
export { DocumentArchiveUpload } from "./document-archive-upload";
