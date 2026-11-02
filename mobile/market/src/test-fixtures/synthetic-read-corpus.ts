import { coreReadCaptureExample } from "./core-read-capture-example";
import { nativeMetadataCaptureExample } from "./native-metadata-capture-example";
import { conversationCaptureExample } from "./conversation-capture-example";
import { replayCoreReadCapture } from "./core-read-capture-replay";
import { replayNativeMetadataCapture } from "./native-metadata-capture-replay";
import { replayConversationCapture } from "./conversation-capture-replay";

export type SyntheticReadCapture = Readonly<
  | { id: string; format: "core"; input: Awaited<ReturnType<typeof coreReadCaptureExample>> }
  | { id: string; format: "metadata"; input: Awaited<ReturnType<typeof nativeMetadataCaptureExample>> }
  | { id: string; format: "conversation"; input: ReturnType<typeof conversationCaptureExample> }
>;
const coreKinds = ["catalog", "comparison", "workspace-orders", "organization-profile", "workflow", "cart", "checkout", "workspace-carts", "support-tickets", "support-ticket"] as const;
const metadataKinds = ["document-archive", "archive-document", "public-cities"] as const;

/** Synthetic fixture registry only. No real input, client, token, endpoint table or response definition. */
export async function syntheticReadCaptureCorpus(): Promise<readonly SyntheticReadCapture[]> {
  const rows: SyntheticReadCapture[] = [];
  for (const kind of coreKinds) rows.push({ id: `core-${kind}`, format: "core", input: await coreReadCaptureExample(kind) });
  for (const kind of metadataKinds) rows.push({ id: `metadata-${kind}`, format: "metadata", input: await nativeMetadataCaptureExample(kind) });
  for (const kind of ["ORDER", "OFFER"] as const) {
    for (const mode of ["plain", "support", "older"] as const) rows.push({ id: `conversation-${kind.toLowerCase()}-${mode}`, format: "conversation", input: conversationCaptureExample(kind, mode === "support", mode === "older") });
  }
  return Object.freeze(rows.map(value => Object.freeze(value)));
}

/** The format chooses an existing consumer; that consumer validates all untrusted saved JSON. */
export function replaySyntheticReadCapture(format: SyntheticReadCapture["format"], input: unknown) {
  if (format === "core") return replayCoreReadCapture(input);
  if (format === "metadata") return replayNativeMetadataCapture(input);
  if (format === "conversation") return replayConversationCapture(input);
  throw Error("Unknown synthetic capture format");
}
