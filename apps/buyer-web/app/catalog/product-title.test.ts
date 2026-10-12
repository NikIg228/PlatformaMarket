import { describe, expect, it } from "vitest";
import { compactProductTitle } from "./product-title";
describe("compact product titles", () => {
  it("uses the curated title without deleting the source", () => {
    expect(compactProductTitle("Original", " Curated A2 4g ")).toBe("Curated A2 4g");
  });
  it("drops LM import prose and fixes casing without dropping size", () => {
    expect(compactProductTitle("LM-Активатор 2 LOW LONG 50 NARROW для ортодонтической и миофунк/й коррекции с при/и")).toBe("LM Activator 2 Low Long 50 Narrow");
    expect(compactProductTitle("LM активатор 2 High шорт 50 Narrow для ортодонтической и миофунк Y коррекции с при и")).toBe("LM Activator 2 High Short 50 Narrow");
    expect(compactProductTitle("LM активатор для ортодонтической и миофункционалной коррекции с принадлежностями в вариантах 3")).toBe("LM Activator · вариант 3");
  });
  it("keeps material shade, weight, model and REF", () => {
    expect(compactProductTitle("LUMEX AC опакуе дентине A2 12 г масса для безметал керамики")).toBe("LUMEX AC Opaque Dentine A2 12 г");
    expect(compactProductTitle("Материал композиционный пломбировочный светоотверждаемый текучий Latelux flow A1-СТОМИР")).toBe("Latelux flow A1");
    expect(compactProductTitle("Пломбировочный материал TETRIC N-BOND UNIVERSAL REF. BTL 1X6G")).toBe("TETRIC N-BOND UNIVERSAL REF. BTL 1X6G");
  });
  it("does not heuristically truncate other product names", () => {
    for (const name of ["3M Clinpro White Varnish", "GC FujiCEM Evolve", "Кейс для инструментов 20 см", "Перчатки нитриловые SafeTouch Ultra"])
      expect(compactProductTitle(name)).toBe(name);
  });
});
