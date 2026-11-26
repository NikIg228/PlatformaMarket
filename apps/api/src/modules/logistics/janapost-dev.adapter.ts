import { createHmac } from "node:crypto";
import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";
import { isLimitedTestStand } from "../../platform/config/limited-stand";
import { OutboundRequestGateway } from "../../platform/security/outbound-request.gateway";

const addressHost = "api.janapost.kz";
const devHost = "api-dev.janatest.kz";
const parentIdSchema = z.union([z.literal("KZ"), z.string().uuid()]);
const branchInputSchema = z.object({
  areaId: z.string().uuid(),
  address: z.string().trim().min(1).max(500),
  start: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  length: z.number().int().min(1).max(100),
});
const mailNoSchema = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);
const jsonContainer = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]);

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  return "{" + Object.keys(value).sort().map(key =>
    JSON.stringify(key) + ":" + canonicalJson(value[key]!),
  ).join(",") + "}";
}

type Operation = "addresses" | "branches" | "status";
const paths = {
  addresses: "/branch_service/public/partnership/address/list",
  branches: "/warehouse/admin/domestic/b2b/branch/list/near/address",
  status: "/warehouse/admin/domestic/get",
} satisfies Record<Operation, string>;

@Injectable()
export class JanaPostDevAdapter {
  private lastTimestamp = 0;

  constructor(private readonly outbound: OutboundRequestGateway) {}

  addresses(parentId: unknown) {
    const parsed = parentIdSchema.safeParse(parentId);
    if (!parsed.success) throw new BadRequestException("Укажите область, город или район.");
    return this.request("addresses", { parentId: parsed.data });
  }

  branches(input: unknown) {
    const parsed = branchInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("Проверьте адрес и параметры поиска отделений.");
    return this.request("branches", parsed.data);
  }

  async status(mailNo: unknown): Promise<string> {
    const parsed = mailNoSchema.safeParse(mailNo);
    if (!parsed.success) throw new BadRequestException("Проверьте трек-номер JanaPost.");
    const result = await this.request("status", { id: parsed.data });
    const status = z.object({ status: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/) }).safeParse(result);
    if (!status.success) throw this.unavailable("JANAPOST_INVALID_RESPONSE");
    return status.data.status;
  }

  private unavailable(code: string): ServiceUnavailableException {
    return new ServiceUnavailableException({ code, message: "Не удалось получить данные JanaPost." });
  }

  private async request(operation: Operation, data: Json) {
    if (process.env.JANAPOST_DEV_ENABLED !== "true"
      || process.env.NODE_ENV === "production" || isLimitedTestStand()) {
      throw this.unavailable("JANAPOST_DEV_DISABLED");
    }

    const body = canonicalJson(data);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const host = operation === "addresses" ? addressHost : devHost;
    if (operation !== "addresses") {
      const clientId = process.env.JANAPOST_DEV_CLIENT_ID;
      const secret = process.env.JANAPOST_DEV_SECRET;
      if (!clientId || !/^[A-Za-z0-9_-]{1,128}$/.test(clientId) || !secret?.trim()) {
        throw this.unavailable("JANAPOST_DEV_CONFIGURATION");
      }

      this.lastTimestamp = Math.max(Date.now(), this.lastTimestamp + 1);
      const timestamp = String(this.lastTimestamp);
      headers["X-RequestClientType"] = "ThirdServices";
      headers["X-RequestClientID"] = clientId;
      headers["X-RequestTimestamp"] = timestamp;
      const message = `X-RequestClientType=ThirdServices&X-RequestClientID=${clientId}&X-RequestTimestamp=${timestamp}&data=${body}`;
      headers["X-RequestClientSign"] = createHmac("sha256", secret).update(message).digest("base64");
    }

    try {
      const response = await this.outbound.request(`https://${host}${paths[operation]}`, {
        method: "POST", allowedHosts: [host], timeoutMs: 10_000,
        maxResponseBytes: 512 * 1024, headers, body,
      });
      if (!response.ok) throw this.unavailable("JANAPOST_UNAVAILABLE");
      return jsonContainer.parse(JSON.parse(await response.text()));
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        throw this.unavailable("JANAPOST_INVALID_RESPONSE");
      }
      throw this.unavailable("JANAPOST_UNAVAILABLE");
    }
  }
}
