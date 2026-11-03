import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { Minimatch, minimatch } from "minimatch";
import ExcelJS from "exceljs";

const require = createRequire(import.meta.url);
const legacyGlob = createRequire(require.resolve("archiver-utils"))("glob");
const modernGlob = createRequire(require.resolve("rimraf"))("glob");
const normalize = files => files.map(file => file.split(path.sep).join("/")).sort();

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "market-dependency-test-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert(path.basename(root).startsWith("market-dependency-test-"));
    fs.rmSync(root, { recursive: true });
  });
  fs.mkdirSync(path.join(root, "nested"));
  for (const file of ["one.txt", "two.csv", "nested/данные файл.txt"])
    fs.writeFileSync(path.join(root, file), "fixture");
  return root;
}

test("glob overrides preserve archiver callback and rimraf async/sync matching", async t => {
  const cwd = fixture(t);
  const expected = ["nested/данные файл.txt", "one.txt"];
  assert.deepEqual(normalize(legacyGlob.sync("**/*.txt", { cwd })), expected);
  const legacy = await new Promise((resolve, reject) =>
    legacyGlob("**/*.txt", { cwd }, (error, files) => error ? reject(error) : resolve(files)));
  assert.deepEqual(normalize(legacy), expected);
  assert.deepEqual(normalize(await modernGlob.glob("**/*.txt", { cwd })), expected);
  assert.deepEqual(normalize(modernGlob.globSync("**/*.txt", { cwd })), expected);
});

test("glob cancellation stops filesystem traversal after rejection", async t => {
  const cwd = fixture(t);
  const controller = new AbortController();
  const reason = new Error("controlled test cancellation");
  let reads = 0;
  const trackedFs = {
    ...fs,
    readdir(...args) {
      const callback = args.pop();
      reads++;
      fs.readdir(...args, (error, entries) => {
        if (reads === 1) controller.abort(reason);
        callback(error, entries);
      });
    },
  };
  await assert.rejects(modernGlob.glob("**/*", { cwd, fs: trackedFs, signal: controller.signal }), error => error === reason);
  assert.equal(reads, 1);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(reads, 1);
});

test("minimatch bounds repeated globstar-parent preprocessing and preserves matching", () => {
  assert(minimatch("a/b.ts", "**/*.{ts,tsx}"));
  assert(!minimatch("a/b.css", "**/*.{ts,tsx}"));
  const matcher = new Minimatch("a/" + "**/../".repeat(8) + "*.txt", { optimizationLevel: 2 });
  assert(matcher.globParts.length < 64);
});

test("ExcelJS retains Unicode cells and numeric values across XLSX write/read", async () => {
  const source = new ExcelJS.Workbook();
  const sheet = source.addWorksheet("Прайс");
  sheet.addRow(["Артикул", "Цена"]);
  sheet.addRow(["Тест-01", 1250.5]);
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(await source.xlsx.writeBuffer());
  assert.equal(restored.getWorksheet("Прайс").getCell("A2").value, "Тест-01");
  assert.equal(restored.getWorksheet("Прайс").getCell("B2").value, 1250.5);
});
