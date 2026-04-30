import { z } from "zod";

const awsRoleArnPattern = /^arn:aws:iam::\d{12}:role\/[\w+=,.@\-_/]+$/i;
const awsIamRoleArnSchema = z
  .string()
  .trim()
  .min(1, "role ARN is required")
  .regex(awsRoleArnPattern, "role ARN must be a valid AWS IAM role ARN");

export const createCloudConnectionSchema = z.object({
  connection_name: z.string().trim().min(1, "Connection name is required"),
  provider: z.enum(["aws", "azure", "gcp", "oracle", "custom"]).optional().default("aws"),
  status: z.literal("draft").optional().default("draft"),
  account_type: z.enum(["payer", "member"]).optional().default("payer"),
});

const awsConnectionCallbackCommonSchema = z.object({
  callback_token: z.string().trim().min(1, "callback_token is required"),
  event_type: z.enum(["stack_create", "stack_update", "stack_delete"]).optional().default("stack_create"),
  account_id: z.string().trim().min(1, "account_id is required"),
  connection_name: z.string().trim().min(1, "connection_name is required").optional(),
  stack_id: z.string().trim().min(1, "stack_id is required"),
  setup_mode: z.literal("cloud_connected").optional().default("cloud_connected"),
});

const awsBillingConnectionCallbackSchema = awsConnectionCallbackCommonSchema.extend({
  role_arn: awsIamRoleArnSchema.optional(),
  billing_role_arn: awsIamRoleArnSchema.optional(),
  billingRoleArn: awsIamRoleArnSchema.optional(),
  action_role_arn: awsIamRoleArnSchema.optional(),
  actionRoleArn: awsIamRoleArnSchema.optional(),
  export_name: z.string().trim().min(1, "export_name is required"),
  export_bucket: z.string().trim().min(1, "export_bucket is required"),
  export_prefix: z.string().trim().min(1, "export_prefix is required"),
  export_region: z.string().trim().min(1, "export_region is required"),
  export_arn: z.string().trim().min(1, "export_arn is required"),
  format: z.literal("parquet").optional().default("parquet"),
  source_type: z.literal("aws_data_exports_cur2").optional().default("aws_data_exports_cur2"),
  schema_type: z.literal("cur2_custom").optional().default("cur2_custom"),
  cadence: z.string().trim().optional().default("hourly"),
}).superRefine((value, ctx) => {
  const billingRoleArn = value.billing_role_arn ?? value.billingRoleArn ?? value.role_arn;
  if (!billingRoleArn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["billing_role_arn"],
      message: "billing_role_arn is required",
    });
  }
}).transform((value) => {
  const billingRoleArn = value.billing_role_arn ?? value.billingRoleArn ?? value.role_arn;
  const actionRoleArn = value.action_role_arn ?? value.actionRoleArn;

  return {
    ...value,
    billing_role_arn: billingRoleArn,
    action_role_arn: actionRoleArn,
  };
});

const awsCloudTrailConnectionCallbackSchema = awsConnectionCallbackCommonSchema.extend({
  role_arn: awsIamRoleArnSchema.optional(),
  source_type: z.literal("aws_cloudtrail"),
  schema_type: z.literal("cloudtrail_json"),
  cadence: z.literal("event_driven").optional().default("event_driven"),
  trail_name: z.string().trim().min(1, "trail_name is required"),
  bucket_name: z.string().trim().min(1, "bucket_name is required"),
  bucket_region: z.string().trim().min(1, "bucket_region is required"),
  prefix: z.string().trim().optional().default(""),
});

export const awsConnectionCallbackSchema = z.union([
  awsBillingConnectionCallbackSchema,
  awsCloudTrailConnectionCallbackSchema,
]);

export const generateAwsCloudFormationSetupSchema = z.object({
  stackName: z.string().trim().min(1, "stackName cannot be empty").optional(),
  externalId: z.string().trim().min(1, "externalId cannot be empty").optional(),
  connectionName: z.string().trim().min(1, "connectionName cannot be empty").optional(),
  region: z.string().trim().min(1, "region cannot be empty").optional(),
  exportPrefix: z.string().trim().min(1, "exportPrefix cannot be empty").optional(),
  exportName: z.string().trim().min(1, "exportName cannot be empty").optional(),
  storageLensExportPrefix: z.string().trim().min(1, "storageLensExportPrefix cannot be empty").optional(),
  storageLensConfigId: z.string().trim().min(1, "storageLensConfigId cannot be empty").optional(),
  callbackUrl: z.string().trim().min(1, "callbackUrl cannot be empty").optional(),
  callbackToken: z.string().trim().min(1, "callbackToken cannot be empty").optional(),
  fileEventCallbackUrl: z.string().trim().min(1, "fileEventCallbackUrl cannot be empty").optional(),
  enableBillingExport: z.boolean().optional().default(true),
  enableCloudTrail: z.boolean().optional().default(false),
  cloudTrailPrefix: z.string().trim().min(1, "cloudTrailPrefix cannot be empty").optional(),
  cloudTrailName: z.string().trim().min(1, "cloudTrailName cannot be empty").optional(),
  enableActionRole: z.boolean().optional().default(true),
  enableEC2Module: z.boolean().optional().default(true),
  enableCloudWatchModule: z.boolean().optional().default(true),
  useTagScopedAccess: z.boolean().optional().default(false),
  resourceTagKey: z.string().trim().min(1, "resourceTagKey cannot be empty").optional(),
  resourceTagValue: z.string().trim().min(1, "resourceTagValue cannot be empty").optional(),
  accountType: z.enum(["payer", "member"]).optional(),
}).superRefine((value, ctx) => {
  if (value.useTagScopedAccess) {
    if (!value.resourceTagKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resourceTagKey"],
        message: "resourceTagKey is required when tag scoped access is enabled",
      });
    }

    if (!value.resourceTagValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["resourceTagValue"],
        message: "resourceTagValue is required when tag scoped access is enabled",
      });
    }
  }
});

export type AwsConnectionCallbackPayload = z.infer<typeof awsConnectionCallbackSchema>;
export type AwsBillingConnectionCallbackPayload = z.infer<typeof awsBillingConnectionCallbackSchema>;
export type AwsCloudTrailConnectionCallbackPayload = z.infer<typeof awsCloudTrailConnectionCallbackSchema>;
export type GenerateAwsCloudFormationSetupPayload = z.infer<typeof generateAwsCloudFormationSetupSchema>;
