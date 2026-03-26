import { z } from "zod"
import { workEmailSchema } from "@/schemas/email.schema"

const trimmed = z.string().transform((value) => value.trim())

function discoveryOtherRefinement(
  value: { discovery?: string; discoveryOther?: string },
  ctx: z.RefinementCtx
) {
  const other = value.discoveryOther?.trim() ?? ""
  const discovery = value.discovery
  if (discovery === "other" && other.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discoveryOther"],
      message: "Please specify.",
    })
  }
}

const scheduleDemoObjectSchema = z.object({
  firstName: trimmed.pipe(z.string().min(1, "First name is required.")),
  lastName: trimmed.pipe(z.string().min(1, "Last name is required.")),
  companyName: trimmed.pipe(z.string().min(1, "Company name is required.")),
  companyEmail: workEmailSchema,
  slotDate: trimmed.pipe(z.string().min(1, "Select a date.")),
  slotTime: trimmed.pipe(z.string().min(1, "Select a time slot.")),
  discovery: z.enum(["referral", "community", "search", "linkedin", "event", "other"], {
    message: "Select an option.",
  }),
  discoveryOther: trimmed.optional(),
})

export const scheduleDemoSchema = scheduleDemoObjectSchema.superRefine(discoveryOtherRefinement)

export type ScheduleDemoValues = z.input<typeof scheduleDemoSchema>
export type ScheduleDemoData = z.output<typeof scheduleDemoSchema>

export const scheduleDemoBaseSchema = scheduleDemoObjectSchema
  .omit({ slotDate: true, slotTime: true })
  .superRefine(discoveryOtherRefinement)
