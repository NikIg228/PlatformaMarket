import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { cdekCitiesSchema, cdekSandboxQuoteSchema, type CdekSandboxQuoteInput } from "@marketplace/schemas";
import { OutboundRequestGateway } from "../../platform/security/outbound-request.gateway";
import { isLimitedTestStand } from "../../platform/config/limited-stand";

const origin = "https://api.edu.cdek.ru/v2";
const tokenSchema = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });
const citiesSchema = z.array(z.object({ code: z.number().int().positive(), city: z.string(), region: z.string().optional() }));
const tariffsSchema = z.object({ tariff_codes: z.array(z.object({
  tariff_code: z.number().int().positive(), tariff_name: z.string(),
  delivery_mode: z.number().int(), delivery_sum: z.union([z.string(), z.number()]),
  period_min: z.number().int().nonnegative(), period_max: z.number().int().nonnegative(),
})) });

@Injectable()
export class CdekSandboxAdapter {
  private token?: { value: string; until: number };
  private authorizing?: Promise<string>;
  constructor(private readonly outbound: OutboundRequestGateway) {}

  enabled() {
    return process.env.CDEK_SANDBOX_ENABLED === "true" && process.env.NODE_ENV !== "production"
      && !isLimitedTestStand() && Boolean(process.env.CDEK_SANDBOX_CLIENT_ID && process.env.CDEK_SANDBOX_CLIENT_SECRET);
  }

  private unavailable() {
    return new ServiceUnavailableException({ code: "CDEK_SANDBOX_UNAVAILABLE", message: "Учебный сервис СДЭК недоступен. Повторите попытку позже." });
  }

  private async authorize(): Promise<string> {
    if (this.token && this.token.until > Date.now()) return this.token.value;
    if (this.authorizing) return this.authorizing;
    this.authorizing = (async () => {
      const response = await this.outbound.request(`${origin}/oauth/token`, {
        method: "POST", allowedHosts: ["api.edu.cdek.ru"], timeoutMs: 10000,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.CDEK_SANDBOX_CLIENT_ID!, client_secret: process.env.CDEK_SANDBOX_CLIENT_SECRET! }).toString(),
      });
      if (!response.ok) throw this.unavailable();
      const token = tokenSchema.parse(JSON.parse(await response.text()));
      this.token = { value: token.access_token, until: Date.now() + Math.max(0, Math.min(token.expires_in, 3600) - 30) * 1000 };
      return token.access_token;
    })();
    try { return await this.authorizing; } finally { this.authorizing = undefined; }
  }

  private async request(path: string, body?: object): Promise<unknown> {
    if (!this.enabled()) throw this.unavailable();
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await this.outbound.request(`${origin}${path}`, {
          method: body ? "POST" : "GET", allowedHosts: ["api.edu.cdek.ru"], timeoutMs: 10000,
          maxResponseBytes: 1024 * 1024,
          headers: { Authorization: `Bearer ${await this.authorize()}`, "content-type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (response.status === 401 && attempt === 0) { this.token = undefined; continue; }
        if (!response.ok) throw this.unavailable();
        return JSON.parse(await response.text());
      }
    } catch { throw this.unavailable(); }
    throw this.unavailable();
  }

  async cities(city: string) {
    try {
      const rows = citiesSchema.parse(await this.request(`/location/cities?${new URLSearchParams({ country_codes: "KZ", city, size: "30" })}`));
      return cdekCitiesSchema.parse(rows.map(row => ({ code: row.code, city: row.city, region: row.region ?? "" })));
    } catch { throw this.unavailable(); }
  }

  async quote(input: CdekSandboxQuoteInput) {
    try {
      const result = tariffsSchema.parse(await this.request("/calculator/tarifflist", {
        type: 1, currency: 2, lang: "rus", from_location: { code: input.fromCityCode },
        to_location: { code: input.toCityCode }, packages: input.packages,
      }));
      return cdekSandboxQuoteSchema.parse({ mode: "sandbox", payable: false, currency: "KZT", calculatedAt: new Date().toISOString(),
        tariffs: result.tariff_codes.filter(row => row.delivery_mode >= 1 && row.delivery_mode <= 4).map(row => {
          const amount = new Prisma.Decimal(String(row.delivery_sum)).mul(100);
          if (!amount.isFinite() || amount.isNegative() || !amount.isInteger() || amount.gt("999999999999")) throw this.unavailable();
          if (row.period_max < row.period_min) throw this.unavailable();
          return { code: row.tariff_code, name: row.tariff_name, deliveryMode: row.delivery_mode, amountMinor: amount.toFixed(0), minDays: row.period_min, maxDays: row.period_max };
        }),
      });
    } catch { throw this.unavailable(); }
  }
}
