"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PilotSigningApiClient } from "@marketplace/api-client/pilot-signing";
import { NcalayerClient } from "@marketplace/eds-client";
import type { PilotIdentityView, PilotSigningSessionView, SubmitPilotCms } from "@marketplace/schemas";
import { useWorkspace } from "./workspace";
import { identityFailure, normalizeIdentityCms } from "./identity-signing-feedback";

export function useIdentitySigning() {
  const { api } = useWorkspace();
  const client = useMemo(() => new PilotSigningApiClient(api), [api]);
  const [identity, setIdentity] = useState<PilotIdentityView | null>(null);
  const [session, setSession] = useState<PilotSigningSessionView | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const lock = useRef(false), generation = useRef(0), createKey = useRef<string | null>(null);
  const pending = useRef<SubmitPilotCms | null>(null);
  const refresh = useCallback(async () => {
    const current = generation.current;
    setLoading(true);
    try {
      const next = await client.call("identity", {});
      const nextSession = next.status === "UNVERIFIED" && next.activeSessionId ? await client.call("session", { sessionId: next.activeSessionId }) : null;
      if (current !== generation.current) return;
      setIdentity(next); setSession(nextSession); setError(null);
      if (nextSession || next.status === "VERIFIED") createKey.current = null;
      if (!nextSession || nextSession.status !== "AWAITING_USER") pending.current = null;
    } catch (cause) { if (current === generation.current) setError(identityFailure(cause)); }
    finally { if (current === generation.current) setLoading(false); }
  }, [client]);
  useEffect(() => { generation.current++; void refresh(); return () => { generation.current++; pending.current = null; }; }, [refresh]);
  useEffect(() => {
    if (!session || !["VERIFYING", "UNKNOWN"].includes(session.status)) return;
    let active = true, pendingPoll = false;
    const timer = window.setInterval(async () => {
      if (lock.current || pendingPoll || document.visibilityState !== "visible") return;
      pendingPoll = true;
      const current = generation.current;
      try {
        const next = await client.call("session", { sessionId: session.id });
        if (!active || lock.current || current !== generation.current) return;
        setSession(next); setError(null);
        if (next.status === "COMMITTED") await refresh();
      } catch (cause) { if (active && current === generation.current) setError(identityFailure(cause)); }
      finally { pendingPoll = false; }
    }, session.status === "UNKNOWN" ? 15000 : 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [client, session, refresh]);
  useEffect(() => {
    if (session?.status !== "AWAITING_USER") return;
    const timer = window.setTimeout(() => { pending.current = null; setSession({ id: session.id, version: session.version, purpose: session.purpose, status: "EXPIRED" }); }, Math.max(0, Date.parse(session.signingInput.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session]);
  async function action(work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await work(); } catch (cause) { setError(identityFailure(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  const create = () => action(async () => {
    createKey.current ??= crypto.randomUUID();
    const next = await client.call("createIdentityChallenge", {}, { idempotencyKey: createKey.current });
    createKey.current = null; pending.current = null; setSession(next);
  });
  const sign = () => action(async () => {
    const current = generation.current;
    if (session?.status !== "AWAITING_USER" || session.signingInput.kind !== "CHALLENGE") return;
    if (!pending.current) {
      const bytes = Uint8Array.from(atob(session.signingInput.contentBase64), character => character.charCodeAt(0));
      const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
      if (checksum !== session.signingInput.checksumSha256) throw new Error("Content mismatch");
      const signed = await new NcalayerClient({ locale: "ru", timeoutMs: 120000 }).signCmsDetached(bytes);
      if (current !== generation.current) return;
      if (signed.dataChecksumSha256 !== checksum) throw new Error("Content mismatch");
      pending.current = { sessionId: session.id, expectedSessionVersion: session.version, cmsBase64: normalizeIdentityCms(signed.signedContainerBase64), idempotencyKey: crypto.randomUUID() };
    }
    const next = await client.call("submitCms", {}, pending.current);
    pending.current = null; setSession(next);
  });
  const transition = (operation: "cancelSession" | "retrySession") => action(async () => {
    if (!session) return;
    const next = await client.call(operation, { sessionId: session.id }, { expectedSessionVersion: session.version, idempotencyKey: crypto.randomUUID() });
    pending.current = null; setSession(next);
  });
  return { identity, session, loading, busy, error, hasPendingCms: pending.current !== null, refresh, create, sign,
    cancel: () => transition("cancelSession"), retry: () => transition("retrySession") };
}
