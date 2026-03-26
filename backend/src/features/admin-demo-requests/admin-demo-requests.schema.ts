import { z } from "zod";

export const adminDemoRequestParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type AdminDemoRequestParamsInput = z.output<typeof adminDemoRequestParamsSchema>;
