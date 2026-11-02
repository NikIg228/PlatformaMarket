import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { readLocalCapture, localCaptureLimitBytes } from "./test-fixtures/read-local-capture";

const directory = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), "local-capture-test-"));
afterAll(() => { rmSync(directory, { recursive: true }); });
it.each([null, false, 123, "SYNTHETIC строка", [], { value: "SYNTHETIC\nҚазақша", nested: { empty: null } }])("reads saved JSON faithfully: %#", value => {
  const file = join(directory, "valid.json"); writeFileSync(file, JSON.stringify(value)); expect(readLocalCapture(file)).toEqual(value);
});
it("accepts exactly the byte limit and rejects the first excess byte", () => {
  const file = join(directory, "limit.json"), json = '"' + "a".repeat(localCaptureLimitBytes - 2) + '"'; writeFileSync(file, json);
  expect((readLocalCapture(file) as string).length).toBe(localCaptureLimitBytes - 2); writeFileSync(file, json + " "); expect(() => readLocalCapture(file)).toThrow("Capture must be a readable regular JSON file of at most 5 MiB.");
});
it.each(["", "{PRIVATE_PAYLOAD", '"unterminated PRIVATE_PAYLOAD'])("malformed JSON never exposes parser prose, path or saved content: %#", text => {
  const file = join(directory, "PRIVATE_PATH.json"); writeFileSync(file, text);
  try { readLocalCapture(file); throw Error("unexpected success"); } catch (error) { expect((error as Error).message).toBe("Capture must be a readable regular JSON file of at most 5 MiB."); }
});
it("directories and absent files use the same fixed error", () => {
  for (const file of [directory, join(directory, "PRIVATE_ABSENT.json")]) expect(() => readLocalCapture(file)).toThrow("Capture must be a readable regular JSON file of at most 5 MiB.");
});
(process.platform === "win32" ? it.skip : it)("a FIFO without writer is rejected in an isolated bounded Node process", () => {
  const fifo = join(directory, "capture.fifo"), made = spawnSync("mkfifo", [fifo], { timeout: 3000, encoding: "utf8" }); expect(made.status).toBe(0);
  const source = pathToFileURL(resolve(__dirname, "test-fixtures/read-local-capture.ts")).href;
  const script = `import { readLocalCapture } from ${JSON.stringify(source)}; try { readLocalCapture(process.argv[1]); process.exitCode=2; } catch(error) { if(error.message === "Capture must be a readable regular JSON file of at most 5 MiB.") process.stdout.write("REJECTED"); else process.exitCode=3; }`;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script, fifo], { timeout: 3000, encoding: "utf8" });
  expect(result.error).toBeUndefined(); expect(result.status).toBe(0); expect(result.stdout).toBe("REJECTED");
});
