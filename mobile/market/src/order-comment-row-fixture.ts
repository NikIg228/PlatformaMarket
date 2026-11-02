import { z } from "zod";
// Local source Prisma-row JSON projection, not an accepted CURRENT response DTO.
export const orderCommentRowBindingFixtureSchema=z.object({id:z.uuid(),supplierOrderId:z.uuid(),authorOrganizationId:z.uuid(),authorUserId:z.uuid(),idempotencyKey:z.string(),visibility:z.literal("PARTIES_AND_OPERATOR"),version:z.number().int().positive()});
export const orderCommentRowFixtureSchema=orderCommentRowBindingFixtureSchema.extend({body:z.string(),createdAt:z.iso.datetime({offset:true}),editedAt:z.iso.datetime({offset:true}).nullable(),updatedAt:z.iso.datetime({offset:true})});
