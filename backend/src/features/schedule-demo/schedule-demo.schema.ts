import { z } from "zod";
import { workEmailSchema } from "../_shared/validation/email.schema.js";

const trimmed = z.string().transform((value) => value.trim());

export const scheduleDemoSchema = z.object({
  firstName: trimmed.pipe(z.string().min(1, "First name is required.")),
  lastName: trimmed.pipe(z.string().min(1, "Last name is required.")),
  companyEmail: workEmailSchema,
  companyName: trimmed.pipe(z.string().min(1, "Company name is required.")),
  heardAboutUs: trimmed.pipe(z.string().min(1, "This field is required.")),
});

export type ScheduleDemoInput = z.output<typeof scheduleDemoSchema>;

