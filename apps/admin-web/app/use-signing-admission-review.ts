"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import { PilotEvidenceUpload, PilotSigningApiClient, pilotSigningErrorCode, pilotSigningOutcomeUnknown } from "@marketplace/api-client/pilot-signing";
import type { OperatorOrganizationDetail, PilotSigningResponse, ReviewPilotPrincipalAdmission } from "@marketplace/schemas";
import { signingAdmissionMessage } from "@marketplace/ui";
import { adminApiContext, readAdminSession } from "./admin-auth";

type Detail = { admission: PilotSigningResponse<"admission">; organization: OperatorOrganizationDetail };
export function useSigningAdmissionReview(id: string) {
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const client = useMemo(() => new PilotSigningApiClient(api), [api]);
  const upload = useMemo(() => { const session = readAdminSession(); return new PilotEvidenceUpload(api, session?.activeOrganizationId ?? session?.organizationId ?? ""); }, [api]);
  const [data, setData] = useState<Detail | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null), [uncertain, setUncertain] = useState(false);
  const [note, setNote] = useState(""), [file, setFile] = useState<File | null>(null), [checked, setChecked] = useState(false);
  const [source, setSource] = useState<"OFFICIAL_REGISTER" | "OFFICIAL_EXTRACT">("OFFICIAL_EXTRACT");
  const [validation, setValidation] = useState<{ file?: string; note?: string; checked?: string }>({});
  const generation = useRef(0), lock = useRef(false), command = useRef<ReviewPilotPrincipalAdmission | null>(null);
  const refresh = useCallback(async () => {
    const current = ++generation.current; setLoading(true); setError(null);
    try {
      const admission = await client.call("admission", { admissionId: id });
      const organization = await api.operatorOrganization(admission.organizationId);
      if (current !== generation.current) return;
      setData({ admission, organization });
      if (admission.status !== "PENDING_REVIEW") { setUncertain(false); command.current = null; setFile(null); setNote(""); }
    } catch (cause) { if (current === generation.current) { setError(signingAdmissionMessage(pilotSigningErrorCode(cause))); setData(null); } }
    finally { if (current === generation.current) setLoading(false); }
  }, [api, client, id]);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);
  async function review(decision: "APPROVE" | "REJECT") {
    if (!data || data.admission.status !== "PENDING_REVIEW" || lock.current) return;
    if (!command.current) {
      const errors = { ...(note.trim().length < 2 ? { note: "Укажите основание решения или причину отказа." } : {}),
        ...(decision === "APPROVE" && (!file || !file.size || file.size > 10_000_000 || !/\.(pdf|docx)$/i.test(file.name)) ? { file: "Приложите PDF или DOCX до 10 МБ с официальным источником проверки." } : {}),
        ...(decision === "APPROVE" && !checked ? { checked: "Подтвердите проверку личности, основания и актуального статуса." } : {}) };
      setValidation(errors); if (Object.keys(errors).length) return;
    }
    lock.current = true; setBusy(true); setError(null); const current = generation.current;
    try {
      if (!command.current) {
        const base = { expectedVersion: data.admission.version, idempotencyKey: crypto.randomUUID() };
        if (decision === "REJECT") command.current = { ...base, decision, reason: note.trim() };
        else {
          const evidenceDocument = await upload.upload(file!);
          if (current !== generation.current) return;
          command.current = { ...base, decision, reviewNote: note.trim(), checkedBasis: data.admission.application.basis,
            verification: { source, evidenceDocument, checkedAt: new Date().toISOString() } };
        }
      }
      const admission = await client.call("reviewAdmission", { admissionId: id }, command.current);
      if (current !== generation.current) return;
      setData(value => value ? { ...value, admission } : value); command.current = null; setUncertain(false); setFile(null); setNote("");
    } catch (cause) {
      if (current !== generation.current) return;
      setError(signingAdmissionMessage(pilotSigningErrorCode(cause)));
      const unknown = pilotSigningOutcomeUnknown(cause); setUncertain(unknown); if (!unknown) command.current = null;
    } finally { lock.current = false; if (current === generation.current) setBusy(false); }
  }
  async function download(documentId: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); const current = generation.current;
    try {
      const result = await api.downloadDocument(documentId);
      if (current !== generation.current) return;
      const url = URL.createObjectURL(result.blob), link = document.createElement("a"); link.href = url; link.download = result.fileName ?? "basis.pdf";
      link.click(); URL.revokeObjectURL(url);
    } catch (cause) { if (current === generation.current) setError(signingAdmissionMessage(pilotSigningErrorCode(cause))); }
    finally { lock.current = false; if (current === generation.current) setBusy(false); }
  }
  return { data, loading, busy, error, uncertain, note, file, checked, source, validation, refresh, review, download,
    retry: () => review(command.current?.decision ?? "APPROVE"),
    setNote: (value: string) => { setNote(value); command.current = null; setValidation({}); },
    setFile: (value: File | null) => { setFile(value); command.current = null; setValidation({}); },
    setSource, setChecked };
}
