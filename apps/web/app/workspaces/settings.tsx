"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DmButton,
  ErrorState,
  LoadingState,
  OrganizationProfileForm,
  MemberManagement,
} from "@marketplace/ui";
import { OnboardingProgress } from "../../../supplier-web/app/onboarding-progress";
import { useWorkspace } from "./workspace";
import { useResource } from "./use-resource";
import { ResourceStatus } from "./resource-status";
import styles from "./workspace.module.css";

export default function Settings() {
  const { role, apiContext, organizationId } = useWorkspace();
  const router = useRouter();
  return (
    <div className={styles.stack}>
      {role === "supplier" ? <Link href="/supplier/settings/sources">Источники товаров и загрузка прайса</Link> : null}
      {role === "supplier" ? (
        <OnboardingProgress
          apiContext={apiContext}
          supplierId={organizationId}
          onNavigate={() => router.push("/supplier/documents")}
        />
      ) : (
        <ClinicSettings />
      )}
      <WorkspaceAccess />
    </div>
  );
}
function WorkspaceAccess() {
  const { api, organizationId, session } = useWorkspace();
  const load = useCallback(() => api.get<string[]>("/access-control/permissions"), [api]);
  const resource = useResource(load);
  return <><ResourceStatus resource={resource} />{resource.data ? <MemberManagement key={organizationId} api={api} organizationId={organizationId} actorId={session.actorId} permissions={resource.error ? [] : resource.data} /> : <LoadingState label="Проверяем права управления сотрудниками" />}</>;
}
function ClinicSettings() {
  const { api, organizationId } = useWorkspace();
  const load = useCallback(async () => {
    const [profile, cities] = await Promise.all([
      api.getOrganizationProfile(),
      api.get<Array<{ id: string; nameRu: string }>>("/catalog/cities"),
    ]);
    if (profile.organizationId !== organizationId)
      throw new Error("Организация недоступна");
    return { profile, cities };
  }, [api, organizationId]);
  const resource = useResource(load, { automatic: false });
  if (resource.error && !resource.data)
    return (
      <ErrorState
        description={resource.error}
        action={
          <DmButton onClick={() => void resource.refresh()}>Повторить</DmButton>
        }
      />
    );
  if (!resource.data) return <LoadingState label="Загружаем реквизиты" />;
  return (
    <section className={styles.panel}>
      <ResourceStatus resource={resource} />
      <OrganizationProfileForm
        value={resource.data.profile}
        cities={resource.data.cities}
        onSave={(input) => api.saveOrganizationProfile(input)}
        onSaved={(profile) =>
          resource.setData((current) =>
            current ? { ...current, profile } : current,
          )
        }
      />
    </section>
  );
}
