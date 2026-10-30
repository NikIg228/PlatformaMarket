"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { adminAuthHeaders } from "./admin-auth";
import { summarizeIntegrationHealth } from "./integration-operations-view-model";
import type {
  Supplier,
  Connection,
  Job,
  Reconciliation,
  Warehouse,
  Offer,
} from "./integration-operations-types";
import { apiUrl } from "./integration-operations-format";

export function useIntegrationReads() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [supplierId, setSupplierId] = useState("");

  const [connections, setConnections] = useState<Connection[]>([]);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [offers, setOffers] = useState<Offer[]>([]);

  const [connectionId, setConnectionId] = useState("");

  const [jobs, setJobs] = useState<Job[]>([]);

  const [reconciliation, setReconciliation] = useState<Reconciliation[]>([]);

  const [loading, setLoading] = useState(true);

  const [detailsLoading, setDetailsLoading] = useState(false);

  const mounted = useRef(true);

  const supplierRead = useRef<AbortController | null>(null);

  const detailRead = useRef<AbortController | null>(null);

  const bootstrapRead = useRef<AbortController | null>(null);

  const [message, setMessage] = useState("");

  const [messageTone, setMessageTone] = useState<"success" | "danger">(
    "success",
  );

  const request = useCallback(
    async <T>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(`${apiUrl}${path}`, {
        ...init,
        cache: "no-store",
        headers: { ...adminAuthHeaders(), ...init?.headers },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string | string[];
        } | null;
        const detail = Array.isArray(payload?.message)
          ? payload.message.join(", ")
          : payload?.message;
        throw new Error(
          detail ?? `Не удалось выполнить запрос (${response.status})`,
        );
      }
      return response.json() as Promise<T>;
    },
    [],
  );

  const loadDetails = useCallback(
    async (activeSupplierId: string, activeConnectionId: string) => {
      detailRead.current?.abort();
      const controller = new AbortController();
      detailRead.current = controller;
      setJobs([]);
      setReconciliation([]);
      setDetailsLoading(Boolean(activeConnectionId));
      if (!activeConnectionId) return;
      try {
        const [jobData, reconciliationData] = await Promise.all([
          request<Job[]>(
            `/suppliers/${activeSupplierId}/integrations/${activeConnectionId}/jobs`,
            { signal: controller.signal },
          ),
          request<Reconciliation[]>(
            `/suppliers/${activeSupplierId}/integrations/${activeConnectionId}/reconciliation?limit=30`,
            { signal: controller.signal },
          ),
        ]);
        if (!mounted.current || controller.signal.aborted) return;
        setJobs(jobData);
        setReconciliation(reconciliationData);
      } catch (error) {
        if (!mounted.current || controller.signal.aborted) return;
        setMessageTone("danger");
        setMessage(
          error instanceof Error ? error.message : "Подключения недоступны.",
        );
        throw error;
      } finally {
        if (mounted.current && !controller.signal.aborted)
          setDetailsLoading(false);
      }
    },
    [request],
  );

  const loadSupplier = useCallback(
    async (activeSupplierId: string, preferredConnectionId?: string) => {
      supplierRead.current?.abort();
      detailRead.current?.abort();
      const controller = new AbortController();
      supplierRead.current = controller;
      setLoading(true);
      setDetailsLoading(false);
      setConnections([]);
      setWarehouses([]);
      setOffers([]);
      setConnectionId("");
      setJobs([]);
      setReconciliation([]);
      try {
        const [connectionData, warehouseData, offerData] = await Promise.all([
          request<Connection[]>(`/suppliers/${activeSupplierId}/integrations`, {
            signal: controller.signal,
          }),
          request<Warehouse[]>(`/suppliers/${activeSupplierId}/warehouses`, {
            signal: controller.signal,
          }),
          request<Offer[]>(`/suppliers/${activeSupplierId}/offers`, {
            signal: controller.signal,
          }),
        ]);
        if (!mounted.current || controller.signal.aborted) return;
        const activeConnectionId =
          preferredConnectionId &&
          connectionData.some(({ id }) => id === preferredConnectionId)
            ? preferredConnectionId
            : (connectionData[0]?.id ?? "");
        setConnections(connectionData);
        setWarehouses(warehouseData);
        setOffers(offerData);
        setConnectionId(activeConnectionId);
        await loadDetails(activeSupplierId, activeConnectionId);
      } catch (error) {
        if (!mounted.current || controller.signal.aborted) return;
        setMessageTone("danger");
        setMessage(
          error instanceof Error ? error.message : "Подключения недоступны.",
        );
        throw error;
      } finally {
        if (mounted.current && !controller.signal.aborted) setLoading(false);
      }
    },
    [loadDetails, request],
  );

  const load = useCallback(async () => {
    bootstrapRead.current?.abort();
    const controller = new AbortController();
    bootstrapRead.current = controller;
    setLoading(true);
    try {
      const supplierData = await request<Supplier[]>("/suppliers", {
        signal: controller.signal,
      });
      if (!mounted.current || controller.signal.aborted) return;
      const activeSupplierId =
        supplierId || supplierData[0]?.organizationId || "";
      setSuppliers(supplierData);
      if (!supplierId && activeSupplierId) setSupplierId(activeSupplierId);
      if (activeSupplierId) await loadSupplier(activeSupplierId, connectionId);
      if (!mounted.current || controller.signal.aborted) return;
      setMessage("");
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      setMessageTone("danger");
      setMessage(
        error instanceof Error ? error.message : "Подключения недоступны.",
      );
    } finally {
      if (mounted.current && !controller.signal.aborted) setLoading(false);
    }
  }, [connectionId, loadSupplier, request, supplierId]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      bootstrapRead.current?.abort();
      supplierRead.current?.abort();
      detailRead.current?.abort();
    };
  }, []);

  const selected = useMemo(
    () => connections.find(({ id }) => id === connectionId) ?? null,
    [connectionId, connections],
  );

  const counts = useMemo(
    () =>
      summarizeIntegrationHealth({
        connectionStatuses: connections.map(({ status }) => status),
        jobStatuses: jobs.map(({ status }) => status),
        reconciliationStatuses: reconciliation.map(({ status }) => status),
      }),
    [connections, jobs, reconciliation],
  );
  return {
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
  };
}
