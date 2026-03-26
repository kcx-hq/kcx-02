import { z } from "zod";
import { workEmailSchema } from "../_shared/validation/email.schema.js";

const trimmed = z.string().transform((value) => value.trim());
const optionalTrimmed = z.string().optional().transform((value) => value?.trim() ?? "");

export const scheduleDemoSchema = z
  .object({
    name: optionalTrimmed,
    firstName: optionalTrimmed,
    lastName: optionalTrimmed,
    email: workEmailSchema.optional(),
    companyEmail: workEmailSchema.optional(),
    companyName: z.string().optional().transform((value) => value?.trim() ?? ""),
    slotStart: z.coerce.date(),
    slotEnd: z.coerce.date(),
  })
  .superRefine((value, context) => {
    const hasEmail = Boolean(value.email || value.companyEmail);
    if (!hasEmail) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Email is required.",
      });
    }

    const hasName = Boolean(value.name || (value.firstName && value.lastName));
    if (!hasName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Name is required.",
      });
    }

    if (value.slotEnd.getTime() <= value.slotStart.getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slotEnd"],
        message: "slotEnd must be after slotStart.",
      });
    }
  })
  .transform((value) => {
    const fullName = value.name || `${value.firstName} ${value.lastName}`.trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(" ") || "Customer";

    return {
      firstName,
      lastName,
      companyEmail: value.companyEmail ?? value.email ?? "",
      companyName: value.companyName || null,
      slotStart: value.slotStart,
      slotEnd: value.slotEnd,
    };
  });

export const scheduleDemoSlotsQuerySchema = z
  .object({
    start: z.coerce.date().optional(),
    end: z.coerce.date().optional(),
  })
  .superRefine((value, context) => {
    if (value.start && value.end && value.end.getTime() <= value.start.getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end"],
        message: "end must be after start.",
      });
    }
  });

export type ScheduleDemoInput = z.output<typeof scheduleDemoSchema>;
export type ScheduleDemoSlotsQueryInput = z.output<typeof scheduleDemoSlotsQuerySchema>;

