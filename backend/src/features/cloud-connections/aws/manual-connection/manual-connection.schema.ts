import { z } from "zod";

export const createManualConnectionSchema = z.object({
  connectionName: z.string().min(1, "connectionName is required"),
  roleArn: z.string().min(1, "roleArn is required"),
  externalId: z.string().min(1, "externalId is required"),
  bucketName: z.string().min(1, "bucketName is required"),
  prefix: z.string().optional(),
  reportName: z.string().min(1, "reportName is required"),
});

export const browseManualBucketSchema = z.object({
  roleArn: z.string().min(1, "roleArn is required"),
  externalId: z.string().min(1, "externalId is required"),
  bucketName: z.string().min(1, "bucketName is required"),
  prefix: z.string().optional(),
});

export type CreateManualConnectionInput = z.infer<typeof createManualConnectionSchema>;
export type BrowseManualBucketInput = z.infer<typeof browseManualBucketSchema>;
