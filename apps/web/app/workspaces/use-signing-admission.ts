"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PilotEvidenceUpload, PilotSigningApiClient, pilotSigningErrorCode, pilotSigningOutcomeUnknown } from "@marketplace/api-client/pilot-signing";
import type { OrganizationRequisitesResponse, PilotIdentityView, PilotSigningResponse, SubmitPilotPrincipalAdmission } from "@marketplace/schemas";
import { signingAdmissionMessage } from "@marketplace/ui";
import { useWorkspace } from "./workspace";

type Bundle = { identity: PilotIdentityView; requisites: OrganizationRequisitesResponse; admission: PilotSigningResponse<"currentAdmission">["admission"] };
export function useSigningAdmission() {
  const { api, organizationId } = useWorkspace();
  const client = useMemo(() => new PilotSigningApiClient(api), [api]);
  const upload = useMemo(() => new PilotEvidenceUpload(api, organizationId), [api, organizationId]);
  const [data, setData] = useState<Bundle | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null), [uncertain, setUncertain] = useState(false);
  const [file, setFile] = useState<File | null>(null), [description, setDescription] = useState("");
  const [validation, setValidation] = useState<{ file?: string; description?: string }>({});
  const command = useRef<SubmitPilotPrincipalAdmission | null>(null), lock = useRef(false), generation = useRef(0);
  const read = useCallback(async (): Promise<Bundle> => {
    const [identity, requisites, current] = await Promise.all([client.call("identity", {}), api.getOrganizationRequisites(), client.call("currentAdmission", { organizationId })]);
    if (requisites.organizationId !== organizationId) throw new Error("Организация изменилась. Откройте настройки заново.");
    return { identity, requisites, admission: current.admission };
  }, [api, client, organizationId]);
  const refresh = useCallback(async () => {
    const current = ++generation.current; setLoading(true); setError(null);
    try {
      const next = await read();
      if (current !== generation.current) return;
      setData(next);
      if (next.admission?.status === "PENDING_REVIEW" || next.admission?.status === "APPROVED") {
        setUncertain(false); command.current = null; setFile(null); setDescription("");
      }
    } catch (cause) {
      if (current === generation.current) {
        const code = pilotSigningErrorCode(cause);
        if (code === "UNAUTHORIZED" || code === "FORBIDDEN" || code === "NOT_FOUND") setData(null);
        setError(signingAdmissionMessage(code));
      }
    }
    finally { if (current === generation.current) setLoading(false); }
  }, [read]);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);

  async function submit() {
    if (lock.current || !data || data.identity.status !== "VERIFIED") return;
    if (!command.current) {
      const errors = { ...(!file ? { file: "Приложите документ основания." } : file.size === 0 || file.size > 10_000_000 || !/\.(pdf|docx)$/i.test(file.name) ? { file: "Выберите PDF или DOCX размером до 10 МБ." } : {}),
        ...(description.trim().length < 2 ? { description: "Укажите название и реквизиты основания." } : {}) };
      setValidation(errors); if (Object.keys(errors).length) return;
    }
    lock.current = true; setBusy(true); setError(null);
    const current = generation.current;
    try {
      if (!command.current) {
        const document = await upload.upload(file!);
        if (current !== generation.current) return;
        const basis = { description: description.trim(), document };
        command.current = { expectedOrganizationVersion: data.requisites.source.organizationVersion,
          identityBinding: { id: data.identity.bindingId, version: data.identity.version },
          basis: data.requisites.current?.fields.legalForm === "INDIVIDUAL_ENTREPRENEUR"
            ? { kind: "INDIVIDUAL_ENTREPRENEUR", registrationNotice: basis } : { kind: "LEGAL_ENTITY_HEAD", appointment: basis },
          idempotencyKey: crypto.randomUUID() };
      }
      const admission = await client.call("submitAdmission", { organizationId }, command.current);
      if (current !== generation.current) return;
      setData(value => value ? { ...value, admission } : value); setUncertain(false); command.current = null;
      setFile(null); setDescription("");
    } catch (cause) {
      if (current !== generation.current) return;
      setError(signingAdmissionMessage(pilotSigningErrorCode(cause)));
      const unknown = pilotSigningOutcomeUnknown(cause); setUncertain(unknown);
      if (!unknown) command.current = null;
    } finally { lock.current = false; if (current === generation.current) setBusy(false); }
  }
  return { data, loading, busy, error, uncertain, file, description, validation, refresh, submit,
    setFile: (value: File | null) => { setFile(value); command.current = null; setValidation({}); },
    setDescription: (value: string) => { setDescription(value); command.current = null; setValidation({}); } };
}
