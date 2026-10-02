import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeBoundedBase64 } from "./bounded-base64";

afterEach(() => vi.restoreAllMocks());

describe("bounded base64 allocation", () => {
  it.each([1, 2, 3, 4, 5, 6])("accepts exactly %i decoded bytes, including padding", (size) => {
    const bytes = Buffer.alloc(size, 65);
    expect(decodeBoundedBase64(bytes.toString("base64"), size)).toEqual(bytes);
  });

  it.each([1, 2, 3, 4, 5, 6])("rejects max %i + 1 before decoding, even within the same encoded length", (size) => {
    const encoded = Buffer.alloc(size + 1, 65).toString("base64");
    const from = vi.spyOn(Buffer, "from");
    expect(() => decodeBoundedBase64(encoded, size)).toThrow("byte limit");
    expect(from).not.toHaveBeenCalled();
  });

  it.each(["", "A===", "====", "AA=A", "AAA", "AA A", "AA\nA", "AA-_", "data:application/pdf;base64,AAAA"])("rejects malformed data without allocation: %j", (value) => {
    const from = vi.spyOn(Buffer, "from");
    expect(() => decodeBoundedBase64(value, 100)).toThrow("Invalid base64");
    expect(from).not.toHaveBeenCalled();
  });
});
