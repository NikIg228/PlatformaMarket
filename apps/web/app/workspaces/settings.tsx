"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DmButton,
  ErrorState,
  LoadingState,
  OrganizationProfileForm,
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
      <header className={styles.heading}>
        <div>
          <h1>Настройки организации</h1>
          <p>Реквизиты, контактные данные и готовность к работе</p>
        </div>
      </header>
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
    </div>
  );
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
