import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { registerCoreOpenApiSchemas } from "./core-openapi";

/** Runtime documentation is a local/test tool, never a production HTTP route. */
export function configureRuntimeSwagger(app: INestApplication, nodeEnvironment: string) {
  if (nodeEnvironment === "production") return;
  const config = new DocumentBuilder()
    .setTitle("B2B Procurement Platform API")
    .setDescription("Industry-independent procurement core")
    .setVersion("0.1.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .build();
  const document = registerCoreOpenApiSchemas(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup("docs", app, document);
}
