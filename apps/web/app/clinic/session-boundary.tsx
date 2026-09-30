"use client";
import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DmButton, ErrorState, LoadingState } from "@marketplace/ui";
import { withWorkspaceReturn } from "@marketplace/schemas/product-navigation";
import { useVerifiedSession, sessionStore } from "../../../buyer-web/app/workspace-session";

export function ClinicSessionBoundary({ children }: { children: ReactNode }) {
  const { session, ready, error } = useVerifiedSession();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  if (!ready) return <LoadingState label="Проверяем вход" />;
  if (!session) return <ErrorState title="Войдите в кабинет клиники" description={error ?? "Кабинет доступен участникам организации."} action={<><DmButton as="a" href={withWorkspaceReturn("/login", pathname + (query ? `?${query}` : ""))}>Войти</DmButton><DmButton onClick={() => void sessionStore.retry()}>Повторить проверку</DmButton></>} />;
  return children;
}
