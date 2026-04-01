import { z } from "zod";

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/g, "");

export const awsManualStep1Schema = z.object({
  bucketName: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "bucketName is required.",
    }),
  bucketPrefix: z
    .string()
    .optional()
    .transform((value) => value?.trim() ?? "")
    .transform((value) => trimTrailingSlashes(value))
    .transform((value) => (value.length > 0 ? value : null)),
});

export type AwsManualStep1Input = z.output<typeof awsManualStep1Schema>;

export const awsManualStep2Schema = z.object({
  connectionId: z.string().uuid({
    message: "connectionId must be a valid uuid.",
  }),
  externalId: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "externalId is required.",
    }),
  roleName: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "roleName is required.",
    }),
  policyName: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "policyName is required.",
    }),
});

export type AwsManualStep2Input = z.output<typeof awsManualStep2Schema>;

export const awsManualStep3Schema = z.object({
  connectionId: z.string().uuid({
    message: "connectionId must be a valid uuid.",
  }),
  connectionName: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "connectionName is required.",
    }),
  reportName: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "reportName is required.",
    }),
  roleArn: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, {
      message: "roleArn is required.",
    })
    .refine((value) => value.startsWith("arn:"), {
      message: "roleArn must start with arn:.",
    }),
});

export type AwsManualStep3Input = z.output<typeof awsManualStep3Schema>;

export const awsManualValidateSchema = z.object({
  connectionId: z.string().uuid({
    message: "connectionId must be a valid uuid.",
  }),
});

export type AwsManualValidateInput = z.output<typeof awsManualValidateSchema>;
