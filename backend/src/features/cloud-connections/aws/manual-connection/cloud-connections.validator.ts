import { parseWithSchema } from "../../../_shared/validation/zod-validate.js";
import {
  awsManualStep1Schema,
  awsManualStep2Schema,
  awsManualStep3Schema,
  awsManualValidateSchema,
  type AwsManualStep1Input,
  type AwsManualStep2Input,
  type AwsManualStep3Input,
  type AwsManualValidateInput,
} from "./cloud-connections.schema.js";

export const parseAwsManualStep1Body = (body: unknown): AwsManualStep1Input =>
  parseWithSchema(awsManualStep1Schema, body);

export const parseAwsManualStep2Body = (body: unknown): AwsManualStep2Input =>
  parseWithSchema(awsManualStep2Schema, body);

export const parseAwsManualStep3Body = (body: unknown): AwsManualStep3Input =>
  parseWithSchema(awsManualStep3Schema, body);

export const parseAwsManualValidateBody = (body: unknown): AwsManualValidateInput =>
  parseWithSchema(awsManualValidateSchema, body);
