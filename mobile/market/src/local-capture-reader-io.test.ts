import { jest } from "@jest/globals";
import * as fs from "node:fs";
import { readLocalCapture, localCaptureLimitBytes } from "./test-fixtures/read-local-capture";

jest.mock("node:fs", () => {
  const actual = jest.requireActual<typeof import("node:fs")>("node:fs");
  return { ...actual, openSync: jest.fn(), fstatSync: jest.fn(), readSync: jest.fn(), closeSync: jest.fn() };
});
const open = jest.mocked(fs.openSync), stat = jest.mocked(fs.fstatSync), read = jest.mocked(fs.readSync), close = jest.mocked(fs.closeSync);
const fixed = "Capture must be a readable regular JSON file of at most 5 MiB.";
beforeEach(() => {
  jest.resetAllMocks(); open.mockReturnValue(0); stat.mockReturnValue({ isFile: () => true, size: 2 } as ReturnType<typeof fs.fstatSync>); read.mockReturnValue(0);
});
it("one descriptor including fd0 is nonblocking, bounded and closed after EOF", () => {
  read.mockReset(); read.mockImplementationOnce((_fd, bytes) => { (bytes as Buffer).write("{}"); return 2; }).mockReturnValueOnce(0);
  expect(readLocalCapture("PRIVATE_PATH")).toEqual({}); expect(open).toHaveBeenCalledTimes(1); expect(open).toHaveBeenCalledWith("PRIVATE_PATH", fs.constants.O_RDONLY | fs.constants.O_NONBLOCK); expect(stat).toHaveBeenCalledWith(0); expect(close).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledWith(0); expect((read.mock.calls[0]! as unknown[])[3]).toBe(localCaptureLimitBytes + 1);
});
it("short reads accumulate on the same descriptor with exact offsets", () => {
  read.mockReset(); for (const [offset, text] of [[0, '{"v":'], [5, '123}']] as const) read.mockImplementationOnce((_fd, bytes, actualOffset) => { expect(actualOffset).toBe(offset); (bytes as Buffer).write(text, offset); return text.length; }); read.mockReturnValueOnce(0);
  expect(readLocalCapture("capture.json")).toEqual({ v: 123 }); expect(open).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
});
it("growth after fstat cannot exceed the bounded extra byte", () => {
  read.mockReset(); read.mockImplementationOnce((...args: unknown[]) => { expect((args[1] as Buffer).length).toBe(localCaptureLimitBytes + 1); return args[3] as number; });
  expect(() => readLocalCapture("capture.json")).toThrow(fixed); expect(read).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
});
it.each(["fstat", "nonregular", "oversize", "read", "parse", "close"] as const)("%s failure remains fixed and closes the opened descriptor", mode => {
  read.mockReset(); read.mockReturnValue(0);
  if (mode === "fstat") stat.mockImplementation(() => { throw Error("PRIVATE_STAT"); });
  else if (mode === "nonregular") stat.mockReturnValue({ isFile: () => false, size: 0 } as ReturnType<typeof fs.fstatSync>);
  else if (mode === "oversize") stat.mockReturnValue({ isFile: () => true, size: localCaptureLimitBytes + 1 } as ReturnType<typeof fs.fstatSync>);
  else if (mode === "read") read.mockImplementation(() => { throw Error("PRIVATE_READ"); });
  else if (mode === "close") { read.mockImplementationOnce((_fd, bytes) => { (bytes as Buffer).write("{}"); return 2; }); close.mockImplementation(() => { throw Error("PRIVATE_CLOSE"); }); }
  expect(() => readLocalCapture("PRIVATE_PATH")).toThrow(fixed); expect(close).toHaveBeenCalledTimes(1); if (["fstat", "nonregular", "oversize"].includes(mode)) expect(read).not.toHaveBeenCalled();
});
it("failed open does not close an unowned descriptor", () => {
  open.mockImplementation(() => { throw Error("PRIVATE_OPEN"); }); expect(() => readLocalCapture("PRIVATE_PATH")).toThrow(fixed); expect(close).not.toHaveBeenCalled(); expect(stat).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
});
