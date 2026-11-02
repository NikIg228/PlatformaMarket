import { nativeSupportAvailable, type NativeSupportCommands } from "./native-support-commands";
import type { SupportTicketDetail } from "../../../packages/schemas/src/support-workflow";
import type { ReadScope } from "./read-controller";
import type { ConversationSupportOrigin } from "./conversation-support-link";
import type { ConversationWriteContext } from "./conversation-write-context";
import { authorizedSupportFixture, type SupportCommandFixture } from "./support-command-fixture";
export type SupportReplyReadContext<TOrigin extends object = ConversationSupportOrigin> = Readonly<{ origin: TOrigin | null; queryActive: boolean; phase: string; ticket: SupportTicketDetail | null }>;
/** Opaque dispatch proof; a parent support pointer never substitutes ticket ownership. */
export function createConversationSupportReplyGuard<TOrigin extends object = ConversationSupportOrigin>(scope: ReadScope, links: Readonly<{isOrigin:(origin:TOrigin)=>boolean;accepts:(ticket:SupportTicketDetail,origin:TOrigin)=>boolean}>, fixture: SupportCommandFixture | undefined, authority: ConversationWriteContext, current: () => SupportReplyReadContext<TOrigin>, native?: NativeSupportCommands) {
  let active = true, proofs = new WeakMap<object, TOrigin | null>();
  const allow = () => active && authority.matches(scope) && authority.isActive() && !authority.authorityIssue();
  const allowReply = () => {
    if (!allow()) return false;
    const context = current();
    return !context.origin || context.queryActive && links.isOrigin(context.origin) && (native ? nativeSupportAvailable(native, scope) : authorizedSupportFixture(scope, fixture) && !!fixture?.authorization.permissions.includes("support.ticket.view"));
  };
  return {
    allow, allowReply,
    capture(ticket: SupportTicketDetail): object | null {
      if (!allowReply()) return null;
      const context = current();
      if (context.origin && (!context.queryActive || context.ticket !== ticket || !links.accepts(ticket, context.origin))) return null;
      const proof = Object.freeze({}); proofs.set(proof, context.origin); return proof;
    },
    isCurrent(proof: unknown) {
      if (!allow() || typeof proof !== "object" || proof === null || !proofs.has(proof)) return false;
      const origin = proofs.get(proof);
      if (!origin) return true;
      const context = current();
      return context.queryActive && context.origin === origin && links.isOrigin(origin) && (context.phase === "loading" || !!context.ticket && links.accepts(context.ticket, origin));
    },
    activate() { active = true; }, close() { active = false; proofs = new WeakMap(); },
  };
}
