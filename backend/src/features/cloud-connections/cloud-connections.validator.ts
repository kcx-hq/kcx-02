import { parseWithSchema } from "../_shared/validation/zod-validate.js";
import { awsManualStep1Schema, type AwsManualStep1Input } from "./cloud-connections.schema.js";

export const parseAwsManualStep1Body = (body: unknown): AwsManualStep1Input =>
  parseWithSchema(awsManualStep1Schema, body);
