# Messages header and operator dialog references

Scope: two generated proposals only, no product implementation or data writes.
Baseline main2f25ed88923f0a956d7d635e4c96c505321a3165. Known receipt files and
three prior image reference directories preserved. Current clinic/messages runtime
inspected in owner's browser: separate status row and inline escalation form confirmed.

Sources: user screenshots codex-clipboard-7cb4aec1-169a-446e-8424-1ff73f44a29c.png
and codex-clipboard-6604d080-529f-4722-8173-44f412a8c0b2.png in local Temp.
Screenshot browser zoom unknown; target references explicitly 1440x900 CSS px/100%.
Contracts market-components-v1 / platforma-semantic-light-v1, DESIGN_SYSTEM.md,
workspace.module.css, shared ConversationWorkspace and DmDialog/DmInfoTip.

Passport: sidebar200px, header61px, logo144px; list300px, gap12px, detail remaining.
Manrope: title20/600/1.25; supplier16/600/1.5; product/body14/400/1.5;
metadata/status12/400/1.5; modal title18/600/1.25. Controls44px radius8px,
cards12px; dialog16px/520px wide, padding24px, gap16px. Neutral field#F0F4F2,
canvas#F6F8F7, white surfaces, primary#007A59, text#17201E, muted#607169,
selected#E4F3ED, divider#D7E1DC. DmButton/DmTextarea/DmDialog/DmInfoTip retained.
Breakpoints unchanged760/1100; these two requested references show desktop only.

1. Compact header: context stack left; status/disclaimer/info/menu as one row right,
centered on product title axis. No additional full-width status row.
2. Escalation: standard centered modal; actor gets conversation access and reason
visible to supplier explicitly explained; reason textarea, cancel/create actions.
No second inline composer. Current service semantics unchanged.

Generator: built-in imagegen, one call per reference, supplied screenshots as inputs.
Full prompts saved alongside images. Raster typography/dimensions are illustrative;
implementation must follow the authoritative adapters and JSON token values.

Visual review: both intended corrections present, Cyrillic content legible, one
bottom composer, no inline escalation form, no invented product actions. Reference1
places status/disclaimer beside product; reference2 has separate modal and explicitly
states supplier visibility. Concept only: generator produced1586x992 rasters rather
than1440x900, sidebar/header proportions vary between images, and exact Manrope
metrics/control dimensions are not certified. Do not adopt raster shell dimensions
or copy punctuation between status and disclaimer as a new design contract.
Files:01-compact-header.png and02-operator-dialog.png. Product code unchanged.

Owner revision: remove the disclaimer and its info icon entirely from chat header;
render actual conversation status as a shared status chip. Operator modal approved.
Pause/moderation lifecycle remains a proposal to define, not implemented by reference.
Generate01-compact-header-v2.png from01 retaining surrounding composition.
Status chip: existing semantic success.soft#EEF8F2 / success.content#237A4A,
compact label12px/600, no action affordance, understated rounded status card.
V2 visually inspected: disclaimer/info icon removed, resolved chip and menu preserved
on product axis. Raster metrics remain approximate as above. Imagegen built-in edit.

Read-only mechanism audit at2f25ed8: escalation atomically creates SupportTicket,
SupportLink/SupportMessage, supportTicketId, shared reason message and audit.
Operator capability + support.ticket.manage + view allow escalated conversation and
protected attachments; create permission adds replies. Admin SupportOperations has
Диалоги с оператором and ticket action Открыть связанный диалог. Tickets support
assignee/status/priority/internal notes, but ticket messages are separate from chat.
No pause/send lock; messages reopen resolved conversation. Chat summary exposes only
resolved/supportTicketId, not ticket state. Ticket close does not synchronize chat;
operator access is not restricted to assigned employee and remains after ticket close.
Escalation bypasses SupportService.create and emits only ConversationMessageSaved,
whose audience lacks operator organization: standard support creation notification
is missing for this path. Recommendations for moderation/state sync/notifications
are proposals, not implemented. No product code, permissions or data changed.
