import { z } from "zod";
import { documentArchiveParticipantSchema as participant } from "../../../packages/schemas/src/core-api";
import type { ArchiveHistoryValue } from "./archive-version-history";
const ids = z.object({ participants: z.array(participant.pick({ organizationId: true, role: true }).extend({ organization: participant.shape.organization.pick({ id: true }) })) });
const labels = z.object({ participants: z.array(participant.pick({ organizationId: true, role: true }).extend({ organization: participant.shape.organization.pick({ id: true, displayName: true }) })) });
export type ArchiveParticipantMetadata = { organizationId: string; role: z.output<typeof participant>["role"]; displayName: string };
export type ArchiveParticipantValue = { parent: ArchiveHistoryValue["parent"]; participants: ArchiveParticipantMetadata[] };
export function decodeArchiveParticipantMetadata(body: unknown): ArchiveParticipantMetadata[] | null {
  const identity = ids.safeParse(body); if (!identity.success || identity.data.participants.some(row => row.organizationId !== row.organization.id)) return null;
  const parsed = labels.safeParse(body); if (!parsed.success || parsed.data.participants.length !== identity.data.participants.length || parsed.data.participants.some((row, i) => row.organizationId !== identity.data.participants[i]?.organizationId || row.role !== identity.data.participants[i]?.role || row.organization.id !== row.organizationId)) return null;
  return parsed.data.participants.map(row => ({ organizationId: row.organizationId, role: row.role, displayName: row.organization.displayName }));
}
