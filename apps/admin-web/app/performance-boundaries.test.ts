import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceExtensions = new Set([".ts", ".tsx"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

describe("Admin performance boundaries", () => {
  const adminApp = resolve(process.cwd(), "app");

  it("does not import the Fluent icon root barrel", () => {
    const offenders = sourceFiles(adminApp)
      .filter((file) => !file.endsWith("performance-boundaries.test.ts"))
      .filter((file) =>
        /(?:from|vi\.mock\()\s*["']@fluentui\/react-icons["']/.test(
          readFileSync(file, "utf8"),
        ),
      );

    expect(offenders).toEqual([]);
  });

  it("keeps the route adapter thin and panels behind the lazy registry", () => {
    expect(readFileSync(join(adminApp, "page.tsx"), "utf8").trim()).toBe(
      'export { default } from "./operations-workspace";',
    );
    const source = readFileSync(join(adminApp, "operations-workspace.tsx"), "utf8");

    expect(source).toContain('from "./admin-section-components"');
    expect(source).not.toContain('from "./live-metrics"');
    expect(source).not.toContain('from "./operation-queue"');
    expect(source).not.toContain('from "./commerce-analytics"');
    expect(source).not.toContain('from "./identity-settings"');
    expect(source).not.toMatch(/from "\.\/(?:supplier|catalog|platform|trust|audit|foundation|agreement|resource|organization|integration|connector)-/);
  });

  it("defines all panels including overview through dynamic imports", () => {
    const source = readFileSync(
      join(adminApp, "admin-section-components.tsx"),
      "utf8",
    );
    const dynamicImports = source.match(/\bimport\("\.\//g) ?? [];

    expect(source).toContain('import dynamic from "next/dynamic"');
    expect(source).toContain('import("./supplier-operations")');
    expect(source).toContain('import("./catalog-import-review")');
    expect(source).toContain('import("./platform-settings")');
    expect(source).toContain('import("./manual-product-review")');
    expect(source).toContain('import("./promotion-moderation")');
    expect(source).toContain('import("./support-operations")');
    expect(source).toContain('import("./operation-object-focus")');
    expect(source).toContain('import("./commerce-analytics")');
    expect(source).toContain('import("./identity-settings")');
    expect(source).toContain('import("./operator-organizations")');
    expect(source).toContain('import("./operator-orders")');
    expect(source).toContain('import("./operator-organization-admission")');
    expect(source).toContain('import("./signing-admissions")');
    expect(source).toContain('import("./live-metrics")');
    expect(source).toContain('import("./operation-queue")');
    expect(source).not.toMatch(/from "\.\//);
    expect(dynamicImports).toHaveLength(28);
  });

  it("keeps domain forms and schemas out of eager shell imports", () => {
    const eagerConsumers = ["page.tsx", "operations-workspace.tsx", "providers.tsx", "admin-shell.tsx", "admin-section-components.tsx", "operation-queue.tsx", "operation-assignment.tsx", "operator-notifications.tsx", "use-admin-access.ts"];
    for (const file of eagerConsumers) {
      expect(readFileSync(join(adminApp, file), "utf8"), file).not.toMatch(/from ["']@marketplace\/ui["']/);
    }
    const restore = readFileSync(join(adminApp, "admin-auth.ts"), "utf8");
    expect(restore).not.toMatch(/import \{[^}]*currentOperatorSessionSchema/);
    expect(restore).toContain('await import("@marketplace/schemas")');
  });
});
