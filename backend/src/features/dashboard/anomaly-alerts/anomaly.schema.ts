import { z } from "zod";

export const listAnomaliesQuerySchema = z.object({
  anomaly_type: z.string().trim().min(1).optional(),
  severity: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  date_from: z.string().trim().min(1).optional(),
  date_to: z.string().trim().min(1).optional(),
  service: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  sub_account: z.string().trim().min(1).optional(),
});

export type ListAnomaliesQuery = z.infer<typeof listAnomaliesQuerySchema>;
