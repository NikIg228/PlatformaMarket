"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import { ActionFeedback } from "@marketplace/ui/action-feedback";
import { DmButton, DmSurface } from "@marketplace/ui/actions";
import { LoadingState } from "@marketplace/ui/primitives";
import { errorMessage, formatStatus } from "@marketplace/ui/format";
import { adminApiContext } from "./admin-auth";
import { useAdminQuery } from "./use-admin-query";
import { OperationImportFocus } from "./operation-import-focus";

export function OperationObjectFocus() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const { state, write } = useAdminQuery();
  const { queueType, object: id } = state;
  const importContext = state.section === "imports" && (queueType === "IMPORT_ATTENTION" || queueType === "INTEGRATION_RECONCILIATION");
  const target = queueType && id && !importContext && !(state.section === "orders" && queueType === "SUPPLIER_CONFIRMATION") ? `${queueType}:${id}` : "";
  const [result, setResult] = useState<{ target: string; object?: Awaited<ReturnType<typeof api.operationObject>>; error?: string }>();
  const [revision, setRevision] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!queueType || !id || !target) { setResult(undefined); return; }
    let active = true;
    setResult(undefined);
    void api.operationObject(queueType, id).then(object => {
      if (active) setResult({ target, object });
    }, cause => { if (active) setResult({ target, error: errorMessage(cause) }); });
    return () => { active = false; };
  }, [api, queueType, id, target, revision]);
  useEffect(() => { if (target) heading.current?.focus(); }, [target]);
  if (importContext && id && queueType) return <OperationImportFocus key={`${queueType}:${id}`} id={id} queueType={queueType} />;
  if (!target) return null;
  const current = result?.target === target ? result : undefined;
  return <section aria-label="Объект из очереди"><DmSurface><div style={{ padding: "var(--dm-space-6)" }}>
    <h2 ref={heading} tabIndex={-1}>{current?.object?.title ?? "Объект из очереди"}</h2>
    {current?.error ? <ActionFeedback tone="error" description={current.error} action={<DmButton onClick={() => setRevision(value => value + 1)}>Повторить</DmButton>} />
      : !current?.object ? <LoadingState label="Открываем объект" />
        : <><dl>{current.object.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{["Статус", "Оплата", "Актуальность", "Риск"].includes(field.label) ? formatStatus(field.value) : field.value}</dd></div>)}</dl><p>Действия по объекту доступны в профильном разделе ниже в пределах ваших полномочий.</p></>}
    <div className="dm-conversations-toolbar">

      <DmButton onClick={() => { write({ ...state, queueType: undefined, object: undefined }); const title = document.querySelector<HTMLElement>("h1"); if (title) { title.tabIndex = -1; title.focus(); } }}>Закрыть объект</DmButton>
    </div>
  </div></DmSurface></section>;
}
