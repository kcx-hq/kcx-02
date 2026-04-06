import { z } from "zod";

export const awsExportFileEventCallbackSchema = z.object({
  callback_token: z.string().trim().min(1, "callback_token is required"),
  trigger_type: z.literal("manifest_created"),
  account_id: z.string().trim().min(1, "account_id is required"),
  region: z.string().trim().min(1, "region is required"),
  role_arn: z.string().trim().min(1, "role_arn is required"),
  bucket_name: z.string().trim().min(1, "bucket_name is required"),
  object_key: z.string().trim().min(1, "object_key is required"),
});
