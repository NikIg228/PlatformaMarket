"use client";

import { StatusTag } from "@marketplace/ui";

import { formatAdminStatus } from "./admin-labels";
import styles from "./integration-operations.module.css";

import {
  jobTypeLabels,
  triggerLabels,
  dateTime,
} from "./integration-operations-format";

import type { Job, Reconciliation } from "./integration-operations-types";

type Props = {
  jobs: Job[];
  reconciliation: Reconciliation[];
};

export function IntegrationActivity({ jobs, reconciliation }: Props) {
  return (
    <div className={styles.activityGrid}>
      <section>
        <header>
          <h4>Обновления</h4>
          <span>{jobs.length}</span>
        </header>
        {jobs.length === 0 ? (
          <div className={styles.empty}>Заданий нет.</div>
        ) : (
          <div className={styles.rows}>
            {jobs.slice(0, 8).map((job) => (
              <div key={job.id}>
                <span>
                  <b>{jobTypeLabels[job.type] ?? "Обновление данных"}</b>
                  <small>
                    {triggerLabels[job.trigger] ?? "Автоматически"}, попытка{" "}
                    {job.attempt} из {job.maxAttempts}
                  </small>
                </span>
                <StatusTag
                  tone={
                    job.status === "SUCCEEDED"
                      ? "success"
                      : job.status === "FAILED" || job.status === "DEAD_LETTER"
                        ? "danger"
                        : "warning"
                  }
                >
                  {formatAdminStatus(job.status)}
                </StatusTag>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <header>
          <h4>Сверка</h4>
          <span>{reconciliation.length}</span>
        </header>
        {reconciliation.length === 0 ? (
          <div className={styles.empty}>Расхождений не обнаружено.</div>
        ) : (
          <div className={styles.rows}>
            {reconciliation.slice(0, 8).map((entry) => (
              <div key={entry.id}>
                <span>
                  <b>{entry.kind}</b>
                  <small>{dateTime(entry.detectedAt)}</small>
                </span>
                <StatusTag
                  tone={
                    entry.status === "MATCHED" || entry.status === "RESOLVED"
                      ? "success"
                      : entry.status === "MISMATCH"
                        ? "danger"
                        : "warning"
                  }
                >
                  {formatAdminStatus(entry.status)}
                </StatusTag>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
