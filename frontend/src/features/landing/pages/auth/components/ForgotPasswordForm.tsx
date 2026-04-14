import { useId, useMemo, useState, type FocusEvent, type FormEvent, type HTMLAttributes } from "react"

import { Button } from "@/components/ui/button"
import { ApiError, apiPost } from "@/lib/api"
import { cn } from "@/lib/utils"
import { validateForm } from "@/lib/validateForm"
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/schemas/auth.schema"

type ForgotTouched = Partial<Record<keyof ForgotPasswordValues, boolean>>

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold tracking-[-0.01em] text-[#0F1F1A]">
      {children}
    </label>
  )
}

function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  autoComplete,
  inputMode,
  required,
  placeholder,
  invalid,
  errorId,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  type?: string
  autoComplete?: string
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"]
  required?: boolean
  placeholder?: string
  invalid?: boolean
  errorId?: string
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="mt-2">
        <input
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          required={required}
          placeholder={placeholder}
          aria-invalid={invalid ? "true" : "false"}
          aria-describedby={errorId}
          className={cn(
            "h-11 w-full border-0 border-b px-2 text-base font-medium tracking-[-0.01em] text-[#1d3138]",
            invalid
              ? "border-red-500/70 bg-transparent placeholder:text-[rgba(111,127,133,0.72)] focus-visible:border-red-500 focus-visible:ring-red-500/15"
              : "border-[rgba(140,158,166,0.6)] bg-transparent placeholder:text-[rgba(111,127,133,0.72)]",
            "transition duration-200 focus-visible:outline-none focus-visible:border-[#3E8A76] focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.2)]"
          )}
        />
      </div>
    </div>
  )
}

export function ForgotPasswordForm() {
  const formId = useId()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [form, setForm] = useState<ForgotPasswordValues>({ email: "" })
  const [touched, setTouched] = useState<ForgotTouched>({})
  const [errors, setErrors] = useState<Partial<Record<keyof ForgotPasswordValues, string>>>({})

  const parsed = useMemo(() => forgotPasswordSchema.safeParse(form), [form])
  const isValid = parsed.success

  function validateAndSet(nextValues: ForgotPasswordValues) {
    const result = validateForm(forgotPasswordSchema, nextValues)
    if (result.success) {
      setErrors({})
      return true
    }
    setErrors(result.errors as Partial<Record<keyof ForgotPasswordValues, string>>)
    return false
  }

  function validateField(field: keyof ForgotPasswordValues, nextValues: ForgotPasswordValues) {
    const result = validateForm(forgotPasswordSchema, nextValues)
    if (result.success) {
      setErrors((prev) => {
        if (!prev[field]) return prev
        const { [field]: _ignored, ...rest } = prev
        return rest
      })
      return
    }
    const message = (result.errors as Record<string, string>)[field as string]
    if (!message) return
    setErrors((prev) => (prev[field] === message ? prev : { ...prev, [field]: message }))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched({ email: true })

    const ok = validateAndSet(form)
    if (!ok) return

    setApiError(null)
    setSubmitting(true)
    void (async () => {
      try {
        await apiPost("/auth/forgot-password", { email: form.email })
        setSubmitted(true)
      } catch (error) {
        if (error instanceof ApiError) {
          setApiError(error.message || "Request failed")
          return
        }
        setApiError("Request failed")
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#3E8A76]">Reset password</p>
      <h2 className="mt-3 text-balance text-[1.35rem] font-semibold leading-[1.1] tracking-[-0.03em] text-[#0F1F1A]">
        Get a reset link
      </h2>
      <p className="mt-3 text-sm leading-7 text-[rgba(75,90,83,0.9)]">
        Enter your email and we’ll send you a password reset link.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit} aria-describedby={`${formId}__help`} noValidate>
        <TextField
          id={`${formId}-email`}
          label="Email"
          value={form.email}
          onChange={(next) => {
            const nextValues = { ...form, email: next }
            setForm(nextValues)
            if (touched.email) validateField("email", nextValues)
          }}
          onBlur={() => {
            setTouched((prev) => ({ ...prev, email: true }))
            validateField("email", form)
          }}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@company.com"
          invalid={touched.email && Boolean(errors.email)}
          errorId={errors.email ? `${formId}-email__error` : undefined}
        />
        {touched.email && errors.email ? (
          <p id={`${formId}-email__error`} className="text-xs text-red-600">
            {errors.email}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={!isValid || submitting || submitted}
          className={cn(
            "mt-2 h-11 w-full rounded-none [border-radius:0!important] bg-[#3E8A76] text-sm font-semibold text-white transition duration-200 hover:bg-[#357563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
            !isValid || submitting || submitted ? "cursor-not-allowed opacity-55 hover:bg-[#3E8A76]" : null
          )}
        >
          {submitted ? "Email Sent" : submitting ? "Sending..." : "Send Reset Link"}
        </Button>

        <p id={`${formId}__help`} className="text-[11px] leading-5 text-[rgba(75,90,83,0.7)]">
          Remembered your password?{" "}
          <a href="/login" className="font-semibold text-[#3E8A76] hover:underline underline-offset-4">
            Sign in
          </a>
          .
        </p>

        {apiError ? (
          <div role="status" className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[#0F1F1A]">
            {apiError}
          </div>
        ) : null}

        {submitted ? (
          <div
            role="status"
            className="rounded-xl border border-[rgba(62,138,118,0.24)] bg-[rgba(62,138,118,0.08)] px-4 py-3 text-sm text-[#0F1F1A]"
          >
            If the email exists, a reset link has been sent.
          </div>
        ) : null}
      </form>
    </div>
  )
}

