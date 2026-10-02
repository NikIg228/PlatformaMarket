import { afterEach, expect, it, vi } from "vitest";
import { SwaggerModule } from "@nestjs/swagger";
import { configureRuntimeSwagger } from "./runtime-swagger";

afterEach(() => vi.restoreAllMocks());
it("does not register UI, JSON or YAML documentation routes in production", () => {
  const create = vi.spyOn(SwaggerModule, "createDocument");
  const setup = vi.spyOn(SwaggerModule, "setup");
  configureRuntimeSwagger({} as never, "production");
  expect(create).not.toHaveBeenCalled(); expect(setup).not.toHaveBeenCalled();
});
it.each(["development", "test"])("retains shared-contract documentation in %s", env => {
  vi.spyOn(SwaggerModule, "createDocument").mockReturnValue({ openapi: "3.0.0", info: { title: "Test", version: "1" }, paths: {} });
  const setup = vi.spyOn(SwaggerModule, "setup").mockImplementation(() => undefined);
  const app = {} as never;
  configureRuntimeSwagger(app, env);
  expect(setup).toHaveBeenCalledWith("docs", app, expect.objectContaining({ openapi: "3.1.0", components: { schemas: expect.objectContaining({ MfaStatus: expect.any(Object), UploadedDocument: expect.any(Object) }) } }));
});
