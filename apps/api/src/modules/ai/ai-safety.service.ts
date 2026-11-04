import { Injectable } from "@nestjs/common";

const injectionPatterns = [
  /ignore (all|any|the|your) (previous|prior|system|developer) instructions?/i,
  /system prompt/i,
  /reveal (secrets?|tokens?|credentials?|api keys?)/i,
  /bypass (authorization|permissions?|tenant|policy)/i,
  /act as (an? )?(admin|operator|root)/i,
  /инструкц.{0,12}(игнор|забуд)/i,
  /(покажи|раскрой|выведи).{0,20}(секрет|токен|ключ|системн)/i,
  /(обойди|отключи).{0,20}(авторизац|права|tenant|политик)/i,
];

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*\b/gi,
  /(?:password|пароль|secret|секрет|(?:access[_-]?|refresh[_-]?)?token|токен|api[_-]?key|client[_-]?secret)["']?\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi,
];

const secretKeyPattern = /^(?:password|пароль|secret|секрет|token|токен|accessToken|refreshToken|apiKey|clientSecret|authorization|cookie|setCookie)$/i;

const medicalAdvicePattern = /(диагноз|назначь лечение|схема лечения|какой препарат назначить|медицинск.{0,12}рекомендац|лечить пациент)/i;
const criticalCommerceActionPattern = /(опубликуй|заблокируй|измени цену|подтверди заказ|проведи оплат|верни деньги|одобри комплаенс)/i;

@Injectable()
export class AiSafetyService {
  inspect(content: string) {
    const reasons = injectionPatterns.filter((pattern) => pattern.test(content)).map((pattern) => pattern.source);
    return { allowed: reasons.length === 0, reasons, containsPossibleSecret: secretPatterns.some((pattern) => { pattern.lastIndex = 0; return pattern.test(content); }), medicalAdviceRequested: medicalAdvicePattern.test(content), criticalCommerceActionRequested: criticalCommerceActionPattern.test(content) };
  }

  redact(content: string) {
    return secretPatterns.reduce((value, pattern) => { pattern.lastIndex = 0; return value.replace(pattern, "[REDACTED]"); }, content);
  }

  redactValue(value: unknown): unknown {
    if (value === undefined) return undefined;
    // Normalize Prisma Decimal/Date/BigInt before inspecting JSON sent or stored.
    const json = JSON.parse(JSON.stringify(value, (_key, current) =>
      typeof current === "bigint" ? current.toString() : current,
    ));
    const visit = (current: unknown): unknown => {
      if (typeof current === "string") return this.redact(current);
      if (Array.isArray(current)) return current.map(visit);
      if (current && typeof current === "object") return Object.fromEntries(
        Object.entries(current).map(([key, item]) => [key,
          secretKeyPattern.test(key.replace(/[_-]/g, "")) ? "[REDACTED]" : visit(item),
        ]),
      );
      return current;
    };
    return visit(json);
  }
}
