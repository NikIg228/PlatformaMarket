"use client";
import { useEffect, useMemo, useState } from "react";
import { MarketplaceApiClient } from "@marketplace/api-client";
import { DmButton, ErrorState, LoadingState, MemberManagement, PermissionsProvider, SessionManagement } from "@marketplace/ui";
import type { AccessPolicy } from "@marketplace/schemas";
import { adminApiContext, clearAdminSession, readAdminSession } from "./admin-auth";

export function IdentitySettings() {
  const [session] = useState(readAdminSession);
  const api = useMemo(() => new MarketplaceApiClient(process.env.NEXT_PUBLIC_API_URL ?? "/api", adminApiContext()), []);
  const [policy, setPolicy] = useState<AccessPolicy | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const organizationId = session?.activeOrganizationId ?? session?.organizationId;
  useEffect(() => { let active = true; setError(false); void api.getAccessPolicy().then(value => { if (active) setPolicy(value); }, () => { if (active) setError(true); }); return () => { active = false; }; }, [api, revision]);
  if (error) return <ErrorState description="Не удалось проверить права управления доступом." action={<DmButton onClick={() => setRevision(value => value + 1)}>Повторить</DmButton>} />;
  if (!policy) return <LoadingState label="Проверяем доступ" />;
  if (!organizationId) return <p>Войдите в аккаунт оператора с активной организацией.</p>;
  return <PermissionsProvider permissions={policy.permissions} mode={policy.mode}><div className="mp-stack"><MemberManagement api={api} organizationId={organizationId} actorId={session?.user?.id} permissions={policy.permissions} /><SessionManagement api={api} currentSessionId={session?.sessionId} onCurrentRevoked={() => { clearAdminSession(); window.location.assign("/admin/login"); }} /></div></PermissionsProvider>;
}
