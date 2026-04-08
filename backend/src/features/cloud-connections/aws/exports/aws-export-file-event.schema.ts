import { z } from "zod";

const awsRoleArnPattern = /^arn:aws:iam::\d{12}:role\/[\w+=,.@\-_/]+$/i;

export const awsExportFileEventCallbackSchema = z.object({
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
});
