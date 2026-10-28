import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { assertSafeZipPackage, XLSX_ZIP_RESOURCE_LIMITS } from "./zip-resource-policy";

function zip(entries: Array<{ body: Buffer; size?: number; method?: number }>) {
  const locals: Buffer[] = [], directory: Buffer[] = [];
  let offset = 0;
  for (const [index, entry] of entries.entries()) {
    const method = entry.method ?? 8, name = Buffer.from(`xl/media/${index}.bin`);
    const payload = method === 0 ? entry.body : deflateRawSync(entry.body);
    const size = entry.size ?? entry.body.length;
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(method, 8);
    local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26); name.copy(local, 30);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(method, 10);
    central.writeUInt32LE(payload.length, 20); central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); name.copy(central, 46);
    locals.push(local, payload); directory.push(central); offset += local.length + payload.length;
  }
  const central = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

describe("ZIP resource policy", () => {
  it("accepts ordinary stored, deflated and empty entries", async () => {
    await expect(assertSafeZipPackage(zip([{ body: Buffer.from("ordinary"), method: 0 }, { body: Buffer.from("ordinary deflate") }, { body: Buffer.alloc(0) }]))).resolves.toBeUndefined();
  });
  it("rejects the advertised per-entry cap before inflation", async () => {
    await expect(assertSafeZipPackage(zip([{ body: Buffer.from("x"), size: XLSX_ZIP_RESOURCE_LIMITS.maxEntryUncompressedBytes + 1 }]))).rejects.toThrow(/entry 0 expands/);
  });
  it("rejects an advertised high compression ratio", async () => {
    await expect(assertSafeZipPackage(zip([{ body: Buffer.alloc(300_000) }]))).rejects.toThrow(/compression ratio/);
  });
  it("rejects ZIP64 sizes", async () => {
    await expect(assertSafeZipPackage(zip([{ body: Buffer.from("x"), size: 0xffffffff }]))).rejects.toThrow(/ZIP64/);
  });
  it.each([0, 1, 1024])("bounds real inflation when the directory claims %i bytes", async size => {
    // A bounded trigger: abort before ExcelJS sees the expanded entry.
    await expect(assertSafeZipPackage(zip([{ body: Buffer.alloc(1024 * 1024), size }]))).rejects.toThrow(/actual expansion/);
  });
  it("rejects stored size mismatches", async () => {
    await expect(assertSafeZipPackage(zip([{ body: Buffer.from("too long"), method: 0, size: 1 }]))).rejects.toThrow(/stored size/);
  });
  it("enforces the total budget across individually valid entries", async () => {
    await expect(assertSafeZipPackage(zip([{ body: Buffer.alloc(60) }, { body: Buffer.alloc(60) }]), { ...XLSX_ZIP_RESOURCE_LIMITS, maxTotalUncompressedBytes: 100 })).rejects.toThrow(/package expands/);
  });
  it("rejects aliased local payloads", async () => {
    const body = zip([{ body: Buffer.from("a") }, { body: Buffer.from("b") }]);
    const directory = body.readUInt32LE(body.length - 6), next = directory + 46 + body.readUInt16LE(directory + 28);
    body.writeUInt32LE(0, next + 42);
    await expect(assertSafeZipPackage(body)).rejects.toThrow(/overlapping/);
  });
  it("rejects truncated compressed payloads", async () => {
    const body = zip([{ body: Buffer.from("a") }]);
    const directory = body.readUInt32LE(body.length - 6);
    body.writeUInt32LE(body.length, directory + 20);
    await expect(assertSafeZipPackage(body)).rejects.toThrow(/truncated/);
  });
});
