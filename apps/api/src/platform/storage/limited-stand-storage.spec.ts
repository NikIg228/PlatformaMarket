import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ObjectStorageService } from "./object-storage.service";

let directory: string | undefined;
afterEach(async () => {
  vi.unstubAllEnvs();
  if (directory) {
    const target = resolve(directory);
    if (!target.startsWith(resolve(tmpdir(), "market-stand-storage-"))) throw new Error("Unexpected cleanup path");
    await rm(target, { recursive: true, force: true });
  }
  directory = undefined;
});
it("keeps test files private and never falls back to public application files", async () => {
  directory = await mkdtemp(join(tmpdir(), "market-stand-storage-"));
  vi.stubEnv("LIMITED_TEST_STAND", "true");
  vi.stubEnv("OBJECT_STORAGE_DRIVER", "local");
  vi.stubEnv("LOCAL_STORAGE_PATH", directory);
  const storage = new ObjectStorageService();
  await storage.put("organization/document.txt", Buffer.from("synthetic"), "text/plain");
  expect((await storage.get("organization/document.txt")).toString()).toBe("synthetic");
  expect(await storage.signedDownloadUrl("organization/document.txt")).toBeNull();
  await expect(storage.get("../../../../package.json")).rejects.toThrow("Unsafe storage key");
  await expect(storage.get("missing-public-file.txt")).rejects.toThrow();
  await expect(storage.put("../outside.txt", Buffer.from("test"), "text/plain")).rejects.toThrow("Unsafe storage key");
  await storage.delete("organization/document.txt");
  await expect(storage.get("organization/document.txt")).rejects.toThrow();
});
