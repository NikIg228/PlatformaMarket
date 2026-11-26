import { z } from "zod";

export const janaPostLocalQuerySchema = z.object({
  city: z.enum(["almaty", "astana", "shymkent"]),
});
export const janaPostLocalResultSchema = z.object({
  points: z.array(z.object({ code: z.string(), name: z.string() })),
  tracking: z.object({ number: z.string(), status: z.literal("arrival_branch") }),
});
export type JanaPostLocalCity = z.infer<typeof janaPostLocalQuerySchema>["city"];
export type JanaPostLocalResult = z.infer<typeof janaPostLocalResultSchema>;
