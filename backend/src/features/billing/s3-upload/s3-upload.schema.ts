import { z } from "zod";

const awsRoleArnPattern = /^arn:aws:iam::\d{12}:role\/[\w+=,.@\-_/]+$/i;
const s3BucketPattern = /^(?!\d+\.\d+\.\d+\.\d+$)(?!-)(?!.*--)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

const normalizeOptionalPrefix = (value: string | undefined): string => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  return normalized;
};

export const createS3UploadSessionSchema = z.object({
  roleArn: z
    .string()
    .trim()
    .min(1, "roleArn is required")
    .regex(awsRoleArnPattern, "roleArn must be a valid AWS IAM role ARN"),
  externalId: z.string().trim().optional(),
  bucket: z
    .string()
    .trim()
    .min(3, "bucket is required")
    .max(63, "bucket is too long")
    .regex(s3BucketPattern, "bucket must be a valid S3 bucket name"),
  prefix: z.string().optional().transform(normalizeOptionalPrefix),
});

export const listS3UploadSessionSchema = z.object({
  prefix: z.string().optional().transform(normalizeOptionalPrefix),
});

export const importS3UploadFilesSchema = z.object({
  objectKeys: z
    .array(z.string().trim().min(1, "object key must not be empty"))
    .min(1, "At least one object key must be selected")
    .max(200, "Too many object keys selected"),
});

export type CreateS3UploadSessionInput = z.infer<typeof createS3UploadSessionSchema>;
export type ListS3UploadSessionInput = z.infer<typeof listS3UploadSessionSchema>;
export type ImportS3UploadFilesInput = z.infer<typeof importS3UploadFilesSchema>;
