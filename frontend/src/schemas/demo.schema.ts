import { z } from "zod"
import { workEmailSchema } from "@/schemas/email.schema"

const trimmed = z.string().transform((value) => value.trim())

export const scheduleDemoSchema = z
  .object({
    firstName: trimmed.pipe(z.string().min(1, "First name is required.")),
    lastName: trimmed.pipe(z.string().min(1, "Last name is required.")),
    companyName: trimmed.pipe(z.string().min(1, "Company name is required.")),
    companyEmail: workEmailSchema,
    discovery: z.enum(["referral", "community", "search", "linkedin", "event", "other"], {
      message: "Select an option.",
    }),
    discoveryOther: trimmed.optional(),
  })
  .superRefine((value, ctx) => {
    const other = (value.discoveryOther ?? "").trim()
    if (value.discovery === "other" && other.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discoveryOther"],
        message: "Please specify.",
      })
    }
  })

export type ScheduleDemoValues = z.input<typeof scheduleDemoSchema>
export type ScheduleDemoData = z.output<typeof scheduleDemoSchema>
