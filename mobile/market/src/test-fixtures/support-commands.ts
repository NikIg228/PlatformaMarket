import type { AddSupportInput } from "../support-command-fixture";
import { supportMessageResponseSchema } from "../../../../packages/schemas/src/support-workflow";
import type { SupportCommandFixture, CreateSupportInput } from "../support-command-fixture";
import { supportId, supportSummary } from "./support";
import { listDraftScope } from "./list-draft";
export const commandScope = listDraftScope;
export function syntheticSupportAuthorization(): SupportCommandFixture["authorization"] { return { provenance: "synthetic-source-contract", scope: { ...commandScope }, operator: false, permissions: ["support.ticket.create"] }; }
export const commandFields = { subject: "  SYNTHETIC обращение  ", description: "  SYNTHETIC описание\nЕкінші жол  ", category: "  SYNTHETIC category  ", priority: "NORMAL" as const };
export function createdTicket(input: CreateSupportInput) { return supportSummary({ id: supportId(330), number: "SYNTHETIC-CREATED-330", subject: input.subject, description: input.description, category: input.category, priority: input.priority }); }
export function commandEnvelope(status: number) { return { status, payload: { statusCode: status, code: "SYNTHETIC_CODE", message: "SYNTHETIC private command error", path: "/support/tickets", timestamp: "2026-10-29T01:02:03.000Z" } }; }

export const replyCommandText = "  SYNTHETIC публичный ответ\nЕкінші жол  ";
export function postedSupportMessage(ticketId: string, input: AddSupportInput) { return supportMessageResponseSchema.parse({ id: supportId(440), ticketId, authorId: commandScope.userId, body: input.body, isInternal: false, attachments: [], createdAt: "2026-10-30T01:02:03.000Z" }); }
