import { z } from "zod";

export const createCloudConnectionSchema = z.object({
  connection_name: z.string().trim().min(1, "Connection name is required"),
  provider: z.enum(["aws", "azure", "gcp", "oracle", "custom"]).optional().default("aws"),
  status: z.literal("draft").optional().default("draft"),
  account_type: z.enum(["payer", "member"]).optional().default("payer"),
});
