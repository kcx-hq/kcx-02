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
