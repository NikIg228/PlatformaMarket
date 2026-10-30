"use client";
import { useState, type FormEvent } from "react";
import type { useIntegrationReads } from "./use-integration-reads";
import type { CreateResult } from "./integration-operations-types";
import { dateTime } from "./integration-operations-format";

type Context = Pick<
  ReturnType<typeof useIntegrationReads>,
  | "supplierId"
  | "connectionId"
  | "selected"
  | "loadSupplier"
  | "request"
  | "setMessage"
  | "setMessageTone"
> & { provider: string; mappingType: "WAREHOUSE" | "VARIANT" };

export function useIntegrationCommands({
  supplierId,
  connectionId,
  selected,
  loadSupplier,
  request,
  setMessage,
  setMessageTone,
  provider,
  mappingType,
}: Context) {
  const [working, setWorking] = useState(false);

  const [oneTimeSecret, setOneTimeSecret] = useState<{
    title: string;
    lines: string[];
  } | null>(null);

  async function act(
    action: () => Promise<unknown>,
    success: string,
    preferredConnectionId = connectionId,
  ) {
    if (!supplierId) return;
    setWorking(true);
    setMessage("");
    try {
      await action();
      await loadSupplier(supplierId, preferredConnectionId);
      setMessageTone("success");
      setMessage(success);
    } catch (error) {
      setMessageTone("danger");
      setMessage(
        error instanceof Error ? error.message : "Операция не выполнена.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function createConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supplierId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const token = String(data.get("accessToken") ?? "").trim();
    const enableWebhook = data.get("enableWebhook") === "on";
    setWorking(true);
    setMessage("");
    try {
      const result = await request<CreateResult>(
        `/suppliers/${supplierId}/integrations`,
        {
          method: "POST",
          body: JSON.stringify({
            provider,
            mode:
              provider === "ONE_C" ? "AGENT" : enableWebhook ? "HYBRID" : "API",
            displayName: data.get("displayName"),
            ...(token ? { credentials: { accessToken: token } } : {}),
            enableWebhook,
            configuration: provider === "MOCK" ? { mockCatalog: [] } : {},
          }),
        },
      );
      const lines = result.enrollment
        ? [
            `Agent ID: ${result.enrollment.agentId}`,
            `Ключ подключения: ${result.enrollment.enrollmentToken}`,
            `Действует до: ${dateTime(result.enrollment.expiresAt)}`,
          ]
        : result.webhook
          ? [
              `Адрес подключения: ${result.webhook.endpointPath}`,
              `Ключ подписи: ${result.webhook.signingSecret}`,
            ]
          : [];
      setOneTimeSecret(
        lines.length ? { title: "Сохраните данные сейчас", lines } : null,
      );
      form.reset();
      await loadSupplier(supplierId, result.connection.id);
      setMessageTone("success");
      setMessage(
        "Подключение создано. Первичная проверка поставлена в очередь.",
      );
    } catch (error) {
      setMessageTone("danger");
      setMessage(
        error instanceof Error ? error.message : "Подключение не создано.",
      );
    } finally {
      setWorking(false);
    }
  }

  function createBinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const scope = String(data.get("scope") ?? "global");
    const scoped = scope.startsWith("warehouse:")
      ? { warehouseId: scope.slice(10) }
      : scope.startsWith("offer:")
        ? { offerId: scope.slice(6) }
        : {};
    return act(
      () =>
        request(
          `/suppliers/${supplierId}/integrations/${selected.id}/bindings`,
          {
            method: "POST",
            body: JSON.stringify({
              dataType: data.get("dataType"),
              priority: Number(data.get("priority") || 100),
              ...scoped,
            }),
          },
        ),
      "Привязка данных создана.",
    );
  }

  function upsertMapping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const form = event.currentTarget;
    return act(async () => {
      await request(
        `/suppliers/${supplierId}/integrations/${selected.id}/mappings`,
        {
          method: "POST",
          body: JSON.stringify({
            entityType: mappingType,
            externalId: data.get("externalId"),
            internalId: data.get("internalId"),
          }),
        },
      );
      form.reset();
    }, "Соответствие сохранено.");
  }

  function enqueueJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const type = String(new FormData(event.currentTarget).get("jobType"));
    return act(
      () =>
        request(`/suppliers/${supplierId}/integrations/${selected.id}/jobs`, {
          method: "POST",
          body: JSON.stringify({
            type,
            idempotencyKey: `ui-${type.toLowerCase()}-${Date.now()}`,
          }),
        }),
      "Задание добавлено в надёжную очередь.",
    );
  }

  function changeStatus(status: "ACTIVE" | "PAUSED" | "REVOKED") {
    if (!selected) return;
    return act(
      () =>
        request(`/suppliers/${supplierId}/integrations/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify({ version: selected.version, status }),
        }),
      status === "PAUSED"
        ? "Подключение приостановлено."
        : status === "ACTIVE"
          ? "Подключение активно."
          : "Доступ подключения отозван.",
    );
  }

  async function rotateEnrollment() {
    if (!selected) return;
    setWorking(true);
    setMessage("");
    try {
      const result = await request<{
        agentId: string;
        enrollmentToken: string;
        expiresAt: string;
      }>(
        `/suppliers/${supplierId}/integrations/${selected.id}/agent/enrollment`,
        { method: "POST" },
      );
      setOneTimeSecret({
        title: "Новый ключ для подключения",
        lines: [
          `Agent ID: ${result.agentId}`,
          `Ключ подключения: ${result.enrollmentToken}`,
          `Действует до: ${dateTime(result.expiresAt)}`,
        ],
      });
      await loadSupplier(supplierId, selected.id);
      setMessageTone("success");
      setMessage("Токен агента перевыпущен. Старый токен недействителен.");
    } catch (error) {
      setMessageTone("danger");
      setMessage(
        error instanceof Error ? error.message : "Токен не перевыпущен.",
      );
    } finally {
      setWorking(false);
    }
  }
  return {
    working,
    oneTimeSecret,
    setOneTimeSecret,
    createConnection,
    createBinding,
    upsertMapping,
    enqueueJob,
    changeStatus,
    rotateEnrollment,
  };
}
