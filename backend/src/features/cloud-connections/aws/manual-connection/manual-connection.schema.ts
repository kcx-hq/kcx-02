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

const optionalTrimmedString = z.string().trim().min(1).optional();

export const completeManualSetupSchema = z
  .object({
    connectionName: z.string().trim().min(1, "connectionName is required"),
    awsAccountId: z.string().trim().regex(/^\d{12}$/, "awsAccountId must be 12 digits"),
    awsRegion: z.string().trim().min(1, "awsRegion is required"),
    externalId: z.string().trim().min(1, "externalId is required"),
    kcxPrincipalArn: z.string().trim().min(1, "kcxPrincipalArn is required"),
    fileEventCallbackUrl: z.string().trim().min(1, "fileEventCallbackUrl is required"),
    callbackToken: z.string().trim().min(1, "callbackToken is required"),
    billingRoleName: z.string().trim().min(1, "billingRoleName is required"),
    billingRoleArn: z.string().trim().min(1, "billingRoleArn is required"),
    exportBucketName: z.string().trim().min(1, "exportBucketName is required"),
    exportPrefix: z.string().trim().min(1, "exportPrefix is required"),
    exportName: optionalTrimmedString,
    exportArn: optionalTrimmedString,
    enableActionRole: z.boolean().default(false),
    actionRoleName: optionalTrimmedString,
    actionRoleArn: optionalTrimmedString,
    enableEc2Module: z.boolean().default(false),
    useTagScopedAccess: z.boolean().default(false),
    billingFileEventLambdaArn: z.string().trim().min(1, "billingFileEventLambdaArn is required"),
    billingEventbridgeRuleName: z.string().trim().min(1, "billingEventbridgeRuleName is required"),
    billingFileEventStatus: z.string().trim().min(1).optional(),
    billingFileEventValidatedAt: z.string().datetime().optional(),
    enableCloudTrail: z.boolean().default(false),
    cloudtrailBucketName: optionalTrimmedString,
    cloudtrailPrefix: optionalTrimmedString,
    cloudtrailTrailName: optionalTrimmedString,
    cloudtrailLambdaArn: optionalTrimmedString,
    cloudtrailEventbridgeRuleName: optionalTrimmedString,
    cloudtrailStatus: z.string().trim().min(1).optional(),
    cloudtrailValidatedAt: z.string().datetime().optional(),
    setupStep: z.number().int().min(1).max(6).optional(),
    setupPayloadJson: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((payload, ctx) => {
    if (!payload.exportName && !payload.exportArn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either exportName or exportArn is required",
        path: ["exportName"],
      });
    }

    if (payload.enableActionRole && !payload.actionRoleArn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "actionRoleArn is required when action role is enabled",
        path: ["actionRoleArn"],
      });
    }

    if (payload.enableCloudTrail) {
      const requiredFields: Array<[keyof typeof payload, string]> = [
        ["cloudtrailBucketName", "cloudtrailBucketName is required when CloudTrail is enabled"],
        ["cloudtrailPrefix", "cloudtrailPrefix is required when CloudTrail is enabled"],
        ["cloudtrailTrailName", "cloudtrailTrailName is required when CloudTrail is enabled"],
      ];

      for (const [field, message] of requiredFields) {
        if (!payload[field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message,
            path: [field],
          });
        }
      }
    }
  });

export type CreateManualConnectionInput = z.infer<typeof createManualConnectionSchema>;
export type BrowseManualBucketInput = z.infer<typeof browseManualBucketSchema>;
export type CompleteManualSetupInput = z.infer<typeof completeManualSetupSchema>;
