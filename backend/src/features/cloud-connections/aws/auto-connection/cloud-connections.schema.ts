import { z } from "zod";

export const createCloudConnectionSchema = z.object({
  connection_name: z.string().trim().min(1, "Connection name is required"),
  provider: z.enum(["aws", "azure", "gcp", "oracle", "custom"]).optional().default("aws"),
  status: z.literal("draft").optional().default("draft"),
  account_type: z.enum(["payer", "member"]).optional().default("payer"),
});

export const awsConnectionCallbackSchema = z.object({
  callback_token: z.string().trim().min(1, "callback_token is required"),
  event_type: z.enum(["stack_create", "stack_update", "stack_delete"]).optional().default("stack_create"),
  account_id: z.string().trim().min(1, "account_id is required"),
  role_arn: z.string().trim().min(1, "role_arn is required"),
  stack_id: z.string().trim().min(1, "stack_id is required"),
  export_name: z.string().trim().min(1, "export_name is required"),
  export_bucket: z.string().trim().min(1, "export_bucket is required"),
  export_prefix: z.string().trim().min(1, "export_prefix is required"),
  export_region: z.string().trim().min(1, "export_region is required"),
  export_arn: z.string().trim().min(1, "export_arn is required"),
  format: z.literal("parquet").optional().default("parquet"),
  source_type: z.literal("aws_data_exports_cur2").optional().default("aws_data_exports_cur2"),
  setup_mode: z.literal("cloud_connected").optional().default("cloud_connected"),
  schema_type: z.literal("cur2_custom").optional().default("cur2_custom"),
  cadence: z.string().trim().optional().default("hourly"),
});

export type AwsConnectionCallbackPayload = z.infer<typeof awsConnectionCallbackSchema>;
