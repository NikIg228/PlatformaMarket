"use client";
import { ActionFeedback } from "@marketplace/ui";
import { useEffect, useMemo, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import { operationQueueTypeSchema } from "@marketplace/schemas";
import { DmButton, LoadingState, errorMessage, formatStatus } from "@marketplace/ui";
import { adminApiContext } from "./admin-auth";

export function OperationObjectFocus() {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const [object, setObject] = useState<Awaited<ReturnType<typeof api.operationObject>> | null>(null);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const type = operationQueueTypeSchema.safeParse(query.get("queueType"));
    const id = query.get("object");
    if (!type.success || !id) return;
    let active = true; setRequested(true); setError("");
    void api.operationObject(type.data, id).then(value => { if (active) setObject(value); }, cause => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [api, revision]);
  if (!requested) return null;
  return <section aria-label="Объект из очереди" style={{ padding: "var(--dm-space-6)", border: "1px solid var(--dm-border)", borderRadius: "var(--dm-radius-card)", marginBottom: "var(--dm-space-6)" }}>
    {error ? <ActionFeedback tone="error" description={error} action={<DmButton onClick={() => setRevision(value => value + 1)}>Повторить</DmButton>} /> : !object ? <LoadingState label="Открываем объект" /> : <><h2>{object.title}</h2><dl>{object.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{["Статус", "Оплата", "Актуальность", "Риск"].includes(field.label) ? formatStatus(field.value) : field.value}</dd></div>)}</dl><p>Действия по объекту доступны в профильном разделе ниже в пределах ваших полномочий.</p><DmButton onClick={() => setRevision(value => value + 1)}>Обновить объект</DmButton></>}
  </section>;
}
