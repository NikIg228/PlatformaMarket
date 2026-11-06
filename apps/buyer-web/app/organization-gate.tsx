"use client";
import { useSearchParams } from "next/navigation";
import { cabinetLoadingLabel } from "@marketplace/ui/loading-state";
import dynamic from "next/dynamic";
import { LoadingState } from "@marketplace/ui";
import type { ReactNode } from "react";
import { useBuyerSession } from "./use-buyer-session";

function ProfileLoading() {
  return <LoadingState label={cabinetLoadingLabel(useSearchParams().get("lang"))} />;
}
const ProfileGate = dynamic(() => import("./organization-profile-gate").then(module => module.OrganizationProfileGate), { ssr: false, loading: ProfileLoading });

export function OrganizationGate({ children }: { children: ReactNode }) {
  const locale = useSearchParams().get("lang");
  const { session, ready } = useBuyerSession();
  if (!ready) return <LoadingState label={cabinetLoadingLabel(locale)} />;
  return session ? <ProfileGate>{children}</ProfileGate> : children;
}
