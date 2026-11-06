import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ResourceStatus } from "./resource-status";

const location = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(location.search) }));
beforeEach(() => { location.search = ""; });

vi.mock("@fluentui/react-components", async () => {
  const { createRequire } = await import("node:module");
  return createRequire(import.meta.url)("@fluentui/react-components");
});

const resource = { lastSuccessAt: 1, refreshing: false, offline: false, error: null as string | null };
it("shows an inline refresh alongside retained content", () => {
  const html = renderToStaticMarkup(<><p>Existing rows</p><ResourceStatus resource={{ ...resource, refreshing: true }} /></>);
  expect(html).toContain("Existing rows");
  expect(html).toContain("Обновляем данные…");
  expect(html).toContain('role="status"');
});
it("does not duplicate the initial page loader or show an idle indicator", () => {
  expect(renderToStaticMarkup(<ResourceStatus resource={{ ...resource, lastSuccessAt: null, refreshing: true }} />)).toBe("");
  expect(renderToStaticMarkup(<ResourceStatus resource={resource} />)).toBe("");
});
it("keeps offline and failed refresh feedback visible instead of a spinner", () => {
  for (const state of [{ ...resource, offline: true }, { ...resource, error: "Unavailable" }]) {
    const html = renderToStaticMarkup(<ResourceStatus resource={{ ...state, refreshing: true }} />);
    expect(html).not.toContain("Обновляем данные…");
    expect(html).toContain('role="status"');
  }
});

it.each(["", "lang=ru", "lang=unknown", "lang=kk"])("uses the URL locale for retained-data states: %s", search => {
  location.search = search;
  const kk = search === "lang=kk";
  const refreshed = renderToStaticMarkup(<><p>Existing rows</p><ResourceStatus resource={{ ...resource, refreshing: true }} /></>);
  expect(refreshed).toContain(kk ? "Деректер жаңартылуда…" : "Обновляем данные…");
  expect(refreshed).toContain("Existing rows");
  expect(refreshed.match(/role="status"/g)).toHaveLength(1);
  const offline = renderToStaticMarkup(<ResourceStatus resource={{ ...resource, refreshing: true, offline: true }} />);
  expect(offline).toContain(kk ? "Желі жоқ. Бұрын жүктелген деректер көрсетілген." : "Нет сети. Показаны ранее загруженные данные.");
  const error = renderToStaticMarkup(<ResourceStatus resource={{ ...resource, refreshing: true, error: "Request R-123" }} />);
  expect(error).toContain(kk ? "Деректерді жүктеу мүмкін болмады: Request R-123. Алдыңғы нұсқа көрсетілген." : "Не удалось загрузить данные: Request R-123. Показана предыдущая версия.");
  expect(error).not.toContain('class="fui-Spinner');
  expect(renderToStaticMarkup(<ResourceStatus resource={{ ...resource, lastSuccessAt: null, refreshing: true }} />)).toBe("");
  expect(renderToStaticMarkup(<ResourceStatus resource={resource} />)).toBe("");
});
