import { formatMinor, formatTimestamp } from "./format-wire";

describe("exact wire display", () => {
  it("places decimals in strings beyond Number precision", () => {
    expect(formatMinor("9007199254740993", "KZT", "ru")).toBe("90\u00a0071\u00a0992\u00a0547\u00a0409,93 KZT");
    expect(formatMinor("9007199254740993.000001", "KZT", "kk")).toBe("90\u00a0071\u00a0992\u00a0547\u00a0409,93000001 KZT");
  });
  it("distinguishes null, zero, negative wire values and incompatible types", () => {
    expect(formatMinor(null, "KZT", "ru")).toBeNull();
    expect(formatMinor("0", "KZT", "ru")).toBe("0,00 KZT");
    expect(formatMinor("-100", "KZT", "ru")).toBe("−1,00 KZT");
    expect(formatMinor("12e3", "KZT", "ru")).toBeNull();
    expect(formatMinor("100", null, "ru")).toBeNull();
    expect(formatMinor("100", "XYZ", "ru")).toBeNull();
  });
  it("uses currency display exponents without rounding fractional minor strings", () => {
    expect(formatMinor("123", "JPY", "ru")).toBe("123 JPY");
    expect(formatMinor("123", "KWD", "kk")).toBe("0,123 KWD");
    expect(formatMinor("100.5", "KZT", "ru")).toBe("1,005 KZT");
  });
});

it.each(["ru", "kk"] as const)("keeps timestamp seconds/offset explicit and missing or unformattable dates unknown in %s", locale => {
  const utc = formatTimestamp("2026-10-28T03:04:05.000Z", locale, "UTC");
  const offset = formatTimestamp("2026-10-28T03:04:05.000Z", locale, "Etc/GMT-5");
  expect(utc).toContain("2026"); expect(utc).toContain("03:04:05"); expect(utc).toContain("GMT");
  expect(offset).toContain("08:04:05"); expect(offset).toContain("GMT+5");
  for (const value of [null, undefined, "", "SYNTHETIC invalid timestamp"]) expect(formatTimestamp(value, locale)).toBeNull();
  expect(formatTimestamp("2026-10-28T03:04:05.000Z", locale, "SYNTHETIC/Invalid")).toBeNull();
});
