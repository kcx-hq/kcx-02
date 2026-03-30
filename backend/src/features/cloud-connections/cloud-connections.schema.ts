import { z } from "zod";

export const createCloudConnectionSchema = z.object({
  connection_name: z.string().min(1, "Connection name is required"),
  provider: z.string().min(1).optional().default("aws"),
  status: z.string().min(1).optional().default("draft"),
  account_type: z.string().min(1).optional().default("payer"),
});

