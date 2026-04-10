import { z } from "zod";

const awsRoleArnPattern = /^arn:aws:iam::\d{12}:role\/[\w+=,.@\-_/]+$/i;

const billingFileEventCallbackSchema = z.object({
  callback_token: z.string().trim().min(1, "callback_token is required"),
  trigger_type: z.enum(["manifest_created", "s3_object_created"]),
  account_id: z.string().trim().min(1, "account_id is required"),
  region: z.string().trim().min(1, "region is required"),
  role_arn: z
    .string()
    .trim()
    .min(1, "role_arn is required")
    .regex(awsRoleArnPattern, "role_arn must be a valid AWS IAM role ARN"),
  bucket_name: z.string().trim().min(1, "bucket_name is required"),
  object_key: z.string().trim().min(1, "object_key is required"),
  source_type: z.literal("aws_data_exports_cur2").optional().default("aws_data_exports_cur2"),
  schema_type: z.literal("cur2_custom").optional().default("cur2_custom"),
  cadence: z.string().trim().optional().default("hourly"),
  event_id: z.string().trim().min(1, "event_id cannot be empty").optional(),
});

const cloudTrailFileEventCallbackSchema = z.object({
  callback_token: z.string().trim().min(1, "callback_token is required"),
  trigger_type: z.literal("cloudtrail_object_created"),
  event_id: z.string().trim().min(1, "event_id cannot be empty").optional(),
  account_id: z.string().trim().optional(),
  region: z.string().trim().optional(),
  role_arn: z.string().trim().regex(awsRoleArnPattern, "role_arn must be a valid AWS IAM role ARN").optional(),
  bucket_name: z.string().trim().min(1, "bucket_name is required"),
  object_key: z.string().trim().min(1, "object_key is required"),
  source_type: z.literal("aws_cloudtrail"),
  schema_type: z.literal("cloudtrail_json"),
  cadence: z.literal("event_driven").optional().default("event_driven"),
});

export const awsExportFileEventCallbackSchema = z.union([
  billingFileEventCallbackSchema,
  cloudTrailFileEventCallbackSchema,
]);

export type AwsExportFileEventPayload = z.infer<typeof awsExportFileEventCallbackSchema>;
export type AwsBillingFileEventPayload = z.infer<typeof billingFileEventCallbackSchema>;
export type AwsCloudTrailFileEventPayload = z.infer<typeof cloudTrailFileEventCallbackSchema>;
