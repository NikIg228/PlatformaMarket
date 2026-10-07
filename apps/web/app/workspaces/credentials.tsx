"use client";
import { ActionFeedback } from "@marketplace/ui";
import { useCallback, useRef, useState } from "react";
import { DmButton, ErrorState, LoadingState, PermissionFields } from "@marketplace/ui";
import { SupplierCompliance } from "../../../supplier-web/app/features/supplier-workspace/supplier-compliance";
import type {
  Credential,
  ComplianceCheck,
} from "../../../supplier-web/app/features/supplier-workspace/types";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import { useWorkspace } from "./workspace";

export function Credentials() {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(async () => {
    const [credentials, checks] = await Promise.all([
      api.get<Credential[]>(
        `/compliance/organizations/${organizationId}/credentials`,
      ),
      api.get<ComplianceCheck[]>("/compliance/checks"),
    ]);
    return { credentials, checks };
  }, [api, organizationId]);
  const resource = useResource(load);
  const [type, setType] = useState("REGISTRATION_CERTIFICATE");
  const [number, setNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  if (resource.error && !resource.data)
    return (
      <ErrorState
        description={resource.error}
        action={
          <DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>
        }
      />
    );
  if (!resource.data)
    return <LoadingState label="Загружаем документы организации" />;
  return (
    <>
      <ResourceStatus resource={resource} />
      {error ? <ActionFeedback tone="error" description={error} /> : null}
      {notice ? <ActionFeedback tone="success" description={notice} /> : null}
      <PermissionFields required={["compliance.credential.manage"]}><SupplierCompliance
        credentials={resource.data.credentials}
        checks={resource.data.checks}
        credentialType={type}
        credentialNumber={number}
        credentialFile={file}
        busy={busy ? "credential" : null}
        onTypeChange={setType}
        onNumberChange={setNumber}
        onFileChange={setFile}
        onSubmit={async () => {
          if (lock.current) return;
          if (!file || !number.trim()) {
            setError("Укажите номер и прикрепите файл документа.");
            return;
          }
          lock.current = true;
          setBusy(true);
          setError(null);
          setNotice("");
          try {
            const contentBase64 = await new Promise<string>(
              (resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () =>
                  resolve(String(reader.result).split(",")[1] ?? "");
                reader.onerror = () =>
                  reject(new Error("Не удалось прочитать файл"));
                reader.readAsDataURL(file);
              },
            );
            await api.post(
              `/compliance/organizations/${organizationId}/credentials`,
              {
                type,
                number: number.trim(),
                issuer: "Поставщик",
                fileName: file.name,
                contentBase64,
                metadata: { source: "supplier-web" },
              },
            );
            setNumber("");
            setFile(null);
            setNotice("Документ отправлен на проверку.");
            await resource.refresh();
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Не удалось отправить документ",
            );
          } finally {
            lock.current = false;
            setBusy(false);
          }
        }}
      />
      </PermissionFields>
    </>
  );
}
