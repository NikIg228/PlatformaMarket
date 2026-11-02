import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Node-only offline entry orchestration. Loader errors become input to the existing redacted decoder. */
export async function writeCaptureReplayReport<T>(load: () => unknown | Promise<unknown>, replay: (input: unknown) => Promise<T>, reportFile: string): Promise<T> {
  let input: unknown;
  try { input = await load(); } catch { input = undefined; }
  const report = await replay(input);
  mkdirSync(dirname(reportFile), { recursive: true });
  writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
  return report;
}
