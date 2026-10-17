"use client";
import { Tab } from "@fluentui/react-components";
import { DmTabList } from "@marketplace/ui";
import { OperatorAudit } from "./operator-audit";
import { OperatorTechnical } from "./operator-technical";
import { useAdminQuery } from "./use-admin-query";
import styles from "./operator-orders.module.css";
export function OperatorControl() {
  const { state, write } = useAdminQuery();
  return <div className={styles.section}><DmTabList selectedValue={state.controlView} onTabSelect={(_, data) => write({ ...state, controlView: data.value as "audit" | "technical" })} aria-label="Аудит и технический контроль"><Tab id="control-audit-tab" value="audit" aria-controls="control-audit">Журнал действий</Tab><Tab id="control-technical-tab" value="technical" aria-controls="control-technical">Техническое состояние</Tab></DmTabList>
    <div role="tabpanel" id={`control-${state.controlView}`} aria-labelledby={`control-${state.controlView}-tab`}>{state.controlView === "audit" ? <OperatorAudit /> : <OperatorTechnical />}</div>
  </div>;
}
