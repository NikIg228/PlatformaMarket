import { constants, openSync, fstatSync, readSync, closeSync } from "node:fs";

export const localCaptureLimitBytes = 5 * 1024 * 1024;
const invalid = () => Error("Capture must be a readable regular JSON file of at most 5 MiB.");

/** Node-only explicit offline input. Never imported by the mobile application. */
export function readLocalCapture(file: string): unknown {
  let descriptor: number | undefined;
  try {
    // A FIFO with no writer must not block before we can reject it with fstat.
    // O_NONBLOCK has no effect on regular-file reads.
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NONBLOCK);
    const info = fstatSync(descriptor);
    if (!info.isFile() || info.size > localCaptureLimitBytes) throw invalid();
    const bytes = Buffer.alloc(localCaptureLimitBytes + 1); let length = 0;
    while (length < bytes.length) {
      const count = readSync(descriptor, bytes, length, bytes.length - length, null);
      if (!count) break;
      length += count;
    }
    if (length > localCaptureLimitBytes) throw invalid();
    return JSON.parse(bytes.subarray(0, length).toString("utf8"));
  } catch { throw invalid(); }
  finally {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { throw invalid(); }
    }
  }
}
