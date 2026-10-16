"use client";
import { useState } from "react";
import { DmDisclosureSummary } from "@marketplace/ui/controls";
import { AgreementOperations } from "./admin-section-components";
import { useAdminQuery } from "./use-admin-query";
export function OperatorOrganizationAdmission() {
  const { state } = useAdminQuery();
  const selected = state.queueType === "ORGANIZATION_REVIEW" || state.queueType === "AGREEMENT_SIGNATURE";
  const [open, setOpen] = useState(selected);
  return <details open={open || selected} onToggle={event => setOpen(event.currentTarget.open)}>
    <DmDisclosureSummary>Договорный допуск поставщиков</DmDisclosureSummary>
    {open || selected ? <AgreementOperations /> : null}
  </details>;
}
