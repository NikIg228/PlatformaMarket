import { createInflateRaw } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const XLSX_ZIP_RESOURCE_LIMITS = {
  maxEntries: 2_000,
  maxEntryUncompressedBytes: 16 * 1024 * 1024,
  maxTotalUncompressedBytes: 64 * 1024 * 1024,
  maxCompressionRatio: 200,
  ratioCheckThresholdBytes: 256 * 1024,
} as const;

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_LENGTH = 22;
const MAX_ZIP_COMMENT_BYTES = 0xffff;

export type ZipResourceLimits = { [K in keyof typeof XLSX_ZIP_RESOURCE_LIMITS]: number };

function reject(message: string): never {
  throw new Error(`ZIP resource limits exceeded: ${message}`);
}

function findEndOfCentralDirectory(body: Buffer) {
  const firstOffset = Math.max(
    0,
    body.length - END_OF_CENTRAL_DIRECTORY_LENGTH - MAX_ZIP_COMMENT_BYTES,
  );
  for (
    let offset = body.length - END_OF_CENTRAL_DIRECTORY_LENGTH;
    offset >= firstOffset;
    offset -= 1
  ) {
    if (body.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      const commentLength = body.readUInt16LE(offset + 20);
      if (offset + END_OF_CENTRAL_DIRECTORY_LENGTH + commentLength <= body.length)
        return offset;
    }
  }
  reject("end of central directory is missing");
}

export async function assertSafeZipPackage(
  body: Buffer,
  limits: ZipResourceLimits = XLSX_ZIP_RESOURCE_LIMITS,
) {
  if (body.length < END_OF_CENTRAL_DIRECTORY_LENGTH)
    reject("package is too small");

  const endOffset = findEndOfCentralDirectory(body);
  const diskNumber = body.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = body.readUInt16LE(endOffset + 6);
  const entriesOnDisk = body.readUInt16LE(endOffset + 8);
  const entryCount = body.readUInt16LE(endOffset + 10);
  const centralDirectorySize = body.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = body.readUInt32LE(endOffset + 16);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount)
    reject("multi-disk or inconsistent directory metadata");
  if (entryCount > limits.maxEntries) reject(`entry count ${entryCount}`);
  if (centralDirectorySize > body.length || centralDirectoryOffset > body.length)
    reject("central directory is outside the package");
  if (centralDirectoryOffset + centralDirectorySize > body.length)
    reject("central directory is truncated");

  let totalUncompressedBytes = 0;
  const entries: Array<{ start: number; end: number; dataStart: number; method: number; size: number }> = [];
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > body.length || body.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE)
      reject("central directory entry is malformed");
    const compressedSize = body.readUInt32LE(offset + 20);
    const uncompressedSize = body.readUInt32LE(offset + 24);
    const nameLength = body.readUInt16LE(offset + 28);
    const extraLength = body.readUInt16LE(offset + 30);
    const commentLength = body.readUInt16LE(offset + 32);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff)
      reject("ZIP64 entry sizes are not supported");
    if (uncompressedSize > limits.maxEntryUncompressedBytes)
      reject(`entry ${index} expands to ${uncompressedSize} bytes`);
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > limits.maxTotalUncompressedBytes)
      reject(`package expands to ${totalUncompressedBytes} bytes`);
    if (
      compressedSize === 0 &&
      uncompressedSize > 0
    ) reject(`entry ${index} has no compressed payload`);
    if (
      compressedSize > 0 &&
      uncompressedSize > limits.ratioCheckThresholdBytes &&
      uncompressedSize / compressedSize > limits.maxCompressionRatio
    ) reject(`entry ${index} compression ratio is too high`);
    const method = body.readUInt16LE(offset + 10);
    const flags = body.readUInt16LE(offset + 8);
    const start = body.readUInt32LE(offset + 42);
    // Bind the directory to the bytes the downstream ZIP reader will inflate.
    if ((flags & 1) || ![0, 8].includes(method)) reject("unsupported ZIP encoding");
    if (start + 30 > centralDirectoryOffset || body.readUInt32LE(start) !== 0x04034b50)
      reject("local header is outside the payload");
    if (body.readUInt16LE(start + 8) !== method || (body.readUInt16LE(start + 6) & 1))
      reject("local encoding differs from directory");
    const dataStart = start + 30 + body.readUInt16LE(start + 26) + body.readUInt16LE(start + 28);
    const end = dataStart + compressedSize;
    if (dataStart > centralDirectoryOffset || end > centralDirectoryOffset) reject("compressed payload is truncated");
    entries.push({ start, end, dataStart, method, size: uncompressedSize });
    offset += 46 + nameLength + extraLength + commentLength;
    if (offset > centralDirectoryOffset + centralDirectorySize)
      reject("central directory entry exceeds its declared bounds");
  }
  if (offset !== centralDirectoryOffset + centralDirectorySize)
    reject("central directory contains trailing or missing entries");
  // Aliases must not repeatedly inflate the same compressed input.
  entries.sort((a, b) => a.start - b.start);
  for (let index = 1; index < entries.length; index++) {
    if (entries[index]!.start < entries[index - 1]!.end) reject("overlapping ZIP entries");
  }
  let actualTotal = 0;
  for (const entry of entries) {
    const payload = body.subarray(entry.dataStart, entry.end);
    if (entry.method === 0) {
      if (payload.length !== entry.size) reject("stored size mismatch");
      actualTotal += payload.length;
      continue;
    }
    const inflater = createInflateRaw({ chunkSize: 16 * 1024 });
    let actualSize = 0;
    inflater.on("data", (chunk: Buffer) => {
      actualSize += chunk.length;
      actualTotal += chunk.length;
      if (actualSize > entry.size || actualSize > limits.maxEntryUncompressedBytes || actualTotal > limits.maxTotalUncompressedBytes)
        inflater.destroy(new Error("actual ZIP expansion exceeds limits"));
    });
    try { await pipeline(Readable.from([payload]), inflater); }
    catch { reject("invalid or excessive actual expansion"); }
    if (actualSize !== entry.size || inflater.bytesWritten !== payload.length)
      reject("inflated size or compressed stream mismatch");
  }
}
