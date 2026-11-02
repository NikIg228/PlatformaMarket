import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FeedbackSurface } from "./feedback-surface";

describe("shared notification boundaries", () => {
  it("announces errors assertively and non-errors politely with decorative icons", () => {
    for (const tone of ["success", "danger", "warning", "info", "neutral"] as const) {
      const html = renderToStaticMarkup(<FeedbackSurface tone={tone} title="Результат" description="Пояснение" />);
      expect(html).toContain(`role="${tone === "danger" ? "alert" : "status"}"`);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('aria-atomic="true"');
      expect(html).toContain("Результат");
    }
  });
  it("keeps blocking detail and recovery inline for every persistent presentation", () => {
    for (const presentation of ["inline", "note"] as const) {
      const html = renderToStaticMarkup(<FeedbackSurface presentation={presentation} tone="danger" title="Ошибка" description="Исправьте данные"
        details={<small>Код обращения: example</small>} action="Повторить" />);
      expect(html).toContain('role="alert"'); expect(html).toContain("Код обращения: example");
      expect(html).toContain("Повторить"); expect(html).not.toContain("dm-save-toast");
    }
  });
});
