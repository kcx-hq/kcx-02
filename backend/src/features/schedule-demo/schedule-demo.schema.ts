import { z } from "zod";
import { businessDateTimeLabelToUTC, isValidIsoDateString } from "../../utils/business-day.js";
import { BUSINESS_TIMEZONE, isValidIanaTimeZone, resolveTimeZone } from "../../utils/timezone.js";
import { workEmailSchema } from "../_shared/validation/email.schema.js";

const optionalTrimmed = z.string().optional().transform((value) => value?.trim() ?? "");
const SLOT_DURATION_MINUTES = 30;
const TIME_LABEL_REGEX = /^(0[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i;

export const scheduleDemoSchema = z
  .object({
    name: optionalTrimmed,
    firstName: optionalTrimmed,
    lastName: optionalTrimmed,
    email: workEmailSchema.optional(),
    companyEmail: workEmailSchema.optional(),
    companyName: z.string().optional().transform((value) => value?.trim() ?? ""),
    heardAboutUs: z.string().optional().transform((value) => value?.trim() ?? ""),
    slotStart: z.coerce.date().optional(),
    slotEnd: z.coerce.date().optional(),
    slotDate: z.string().optional(),
    slotTime: z.string().optional(),
    timeZone: z.string().optional(),
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

    if (!value.heardAboutUs || value.heardAboutUs.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["heardAboutUs"],
        message: "heardAboutUs is required.",
      });
    }

    const hasSlotRange = Boolean(value.slotStart && value.slotEnd);
    const hasSlotDateTime = Boolean(value.slotDate && value.slotTime);

    if (!hasSlotRange && !hasSlotDateTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slotDate"],
        message: "Select a date and time slot.",
      });
      return;
    }

    if (hasSlotRange && value.slotStart && value.slotEnd) {
      if (value.slotEnd.getTime() <= value.slotStart.getTime()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slotEnd"],
          message: "slotEnd must be after slotStart.",
        });
      }
      return;
    }

    if (hasSlotDateTime) {
      if (!value.slotDate || !isValidIsoDateString(value.slotDate)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slotDate"],
          message: "slotDate must be YYYY-MM-DD.",
        });
      }

      if (!value.slotTime || !TIME_LABEL_REGEX.test(value.slotTime)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slotTime"],
          message: "slotTime must be a valid label like 09:00 AM.",
        });
      }
    }

    if (value.timeZone && !isValidIanaTimeZone(value.timeZone)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timeZone"],
        message: "timeZone must be a valid IANA timezone.",
      });
    }
  })
  .transform((value) => {
    const fullName = value.name || `${value.firstName} ${value.lastName}`.trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(" ") || "Customer";

    const effectiveTimeZone = resolveTimeZone(value.timeZone, BUSINESS_TIMEZONE);

    const slotRange =
      value.slotStart && value.slotEnd
        ? { slotStart: value.slotStart, slotEnd: value.slotEnd }
        : (() => {
            const slotStart = businessDateTimeLabelToUTC(
              value.slotDate ?? "",
              value.slotTime ?? "",
              effectiveTimeZone,
            );
            const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MINUTES * 60_000);
            return { slotStart, slotEnd };
          })();

    return {
      firstName,
      lastName,
      companyEmail: value.companyEmail ?? value.email ?? "",
      companyName: value.companyName || null,
      heardAboutUs: value.heardAboutUs || null,
      slotStart: slotRange.slotStart,
      slotEnd: slotRange.slotEnd,
      timeZone: effectiveTimeZone,
    };
  });

export const scheduleDemoSlotsQuerySchema = z
  .object({
    date: z.string(),
    timeZone: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (!isValidIsoDateString(value.date)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date"],
        message: "date must be YYYY-MM-DD.",
      });
    }

    if (value.timeZone && !isValidIanaTimeZone(value.timeZone)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["timeZone"],
        message: "timeZone must be a valid IANA timezone.",
      });
    }
  });

export const scheduleDemoSlotsDateParamSchema = z.object({
  date: z
    .string()
    .refine((value) => isValidIsoDateString(value), { message: "date must be YYYY-MM-DD." }),
});

export const scheduleDemoSlotsTimeZoneQuerySchema = z.object({
  timeZone: z
    .string()
    .optional()
    .refine((value) => !value || isValidIanaTimeZone(value), {
      message: "timeZone must be a valid IANA timezone.",
    }),
});

export type ScheduleDemoInput = z.output<typeof scheduleDemoSchema>;
export type ScheduleDemoSlotsQueryInput = z.output<typeof scheduleDemoSlotsQuerySchema>;
export type ScheduleDemoSlotsDateParamInput = z.output<typeof scheduleDemoSlotsDateParamSchema>;
export type ScheduleDemoSlotsTimeZoneQueryInput = z.output<typeof scheduleDemoSlotsTimeZoneQuerySchema>;

