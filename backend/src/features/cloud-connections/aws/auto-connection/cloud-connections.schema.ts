import { z } from "zod";

export const createCloudConnectionSchema = z.object({
  connection_name: z.string().trim().min(1, "Connection name is required"),
  provider: z.enum(["aws", "azure", "gcp", "oracle", "custom"]).optional().default("aws"),
  status: z.literal("draft").optional().default("draft"),
  account_type: z.enum(["payer", "member"]).optional().default("payer"),
});

export const awsConnectionCallbackSchema = z.object({
  callback_token: z.string().trim().min(1, "callback_token is required"),
  account_id: z.string().trim().min(1, "account_id is required"),
  role_arn: z.string().trim().min(1, "role_arn is required"),
  stack_id: z.string().trim().min(1, "stack_id is required"),
});
