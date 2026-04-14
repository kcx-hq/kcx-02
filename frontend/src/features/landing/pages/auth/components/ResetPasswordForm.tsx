import { useId, useMemo, useState, type FocusEvent, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { ApiError, apiPost } from "@/lib/api"
import { cn } from "@/lib/utils"
import { validateForm } from "@/lib/validateForm"
import { resetPasswordSchema, type ResetPasswordValues } from "@/schemas/auth.schema"

type ResetTouched = Partial<Record<keyof ResetPasswordValues, boolean>>
type ResetErrors = Partial<Record<keyof ResetPasswordValues, string>>

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
          required={required}
          placeholder={placeholder}
          aria-invalid={invalid ? "true" : "false"}
          aria-describedby={errorId}
          className={cn(
            "h-11 w-full rounded-xl border px-3 text-sm text-[#0F1F1A]",
            invalid
              ? "border-red-500/70 bg-white placeholder:text-[rgba(75,90,83,0.55)] focus-visible:border-red-500 focus-visible:ring-red-500/15"
              : "border-[rgba(21,37,49,0.16)] bg-white placeholder:text-[rgba(75,90,83,0.55)]",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition duration-200",
            "focus-visible:outline-none focus-visible:border-[rgba(62,138,118,0.55)] focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.22)]"
          )}
        />
      </div>
    </div>
  )
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const formId = useId()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const [form, setForm] = useState<ResetPasswordValues>({
    newPassword: "",
    confirmPassword: "",
  })
  const [touched, setTouched] = useState<ResetTouched>({})
  const [errors, setErrors] = useState<ResetErrors>({})

  const parsed = useMemo(() => resetPasswordSchema.safeParse(form), [form])
  const isValid = parsed.success
  const hasToken = Boolean(token)

  function validateAndSet(nextValues: ResetPasswordValues) {
    const result = validateForm(resetPasswordSchema, nextValues)
    if (result.success) {
      setErrors({})
      return true
    }
    setErrors(result.errors as ResetErrors)
    return false
  }

  function validateField(field: keyof ResetPasswordValues, nextValues: ResetPasswordValues) {
    const result = validateForm(resetPasswordSchema, nextValues)
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
    setTouched({ newPassword: true, confirmPassword: true })

    if (!token) {
      setApiError("Reset link is invalid or missing a token.")
      return
    }

    const ok = validateAndSet(form)
    if (!ok) return

    setApiError(null)
    setSubmitting(true)
    void (async () => {
      try {
        await apiPost<{ success: true }>("/auth/reset-password", {
          token,
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword,
        })
        setSubmitted(true)
      } catch (error) {
        if (error instanceof ApiError) {
          setApiError(error.message || "Reset failed")
          return
        }
        setApiError("Reset failed")
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#3E8A76]">Reset password</p>
      <h2 className="mt-3 text-balance text-[1.35rem] font-semibold leading-[1.1] tracking-[-0.03em] text-[#0F1F1A]">
        {hasToken ? "Set a new password" : "Check your email"}
      </h2>
      <p
        className="mt-3 text-sm leading-7 text-[rgba(75,90,83,0.9)]"
        style={{ display: hasToken ? "block" : "none" }}
      >
        Choose a strong password you haven’t used before.
      </p>
      <p
        className="mt-3 text-sm leading-7 text-[rgba(75,90,83,0.9)]"
        style={{ display: hasToken ? "none" : "block" }}
      >
        Use the secure link in your reset email to set a new password.
      </p>

      {hasToken ? (
      <form className="mt-6 space-y-4" onSubmit={onSubmit} aria-describedby={`${formId}__help`} noValidate>
        <div>
          <TextField
            id={`${formId}-newPassword`}
            label="New Password"
            value={form.newPassword}
            onChange={(next) => {
              const nextValues = { ...form, newPassword: next }
              setForm(nextValues)
              if (touched.newPassword) validateField("newPassword", nextValues)
            }}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, newPassword: true }))
              validateField("newPassword", form)
            }}
            type="password"
            required
            placeholder="••••••••"
            invalid={touched.newPassword && Boolean(errors.newPassword)}
            errorId={errors.newPassword ? `${formId}-newPassword__error` : undefined}
          />
          {touched.newPassword && errors.newPassword ? (
            <p id={`${formId}-newPassword__error`} className="mt-1 text-xs text-red-600">
              {errors.newPassword}
            </p>
          ) : null}
        </div>

        <div>
          <TextField
            id={`${formId}-confirmPassword`}
            label="Confirm Password"
            value={form.confirmPassword}
            onChange={(next) => {
              const nextValues = { ...form, confirmPassword: next }
              setForm(nextValues)
              if (touched.confirmPassword) validateField("confirmPassword", nextValues)
            }}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, confirmPassword: true }))
              validateField("confirmPassword", form)
            }}
            type="password"
            required
            placeholder="••••••••"
            invalid={touched.confirmPassword && Boolean(errors.confirmPassword)}
            errorId={errors.confirmPassword ? `${formId}-confirmPassword__error` : undefined}
          />
          {touched.confirmPassword && errors.confirmPassword ? (
            <p id={`${formId}-confirmPassword__error`} className="mt-1 text-xs text-red-600">
              {errors.confirmPassword}
            </p>
          ) : null}
        </div>

        <Button
          type="submit"
          disabled={!isValid || submitting || submitted}
          className={cn(
            "mt-2 h-11 w-full rounded-none [border-radius:0!important] bg-[#3E8A76] text-sm font-semibold text-white transition duration-200 hover:bg-[#357563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
            !isValid || submitting || submitted ? "cursor-not-allowed opacity-55 hover:bg-[#3E8A76]" : null
          )}
        >
          {submitted ? "Password Updated" : submitting ? "Updating..." : "Update Password"}
        </Button>

        <p id={`${formId}__help`} className="text-[11px] leading-5 text-[rgba(75,90,83,0.7)]">
          After resetting, you can{" "}
          <a href="/login" className="font-semibold text-[#3E8A76] hover:underline underline-offset-4">
            sign in
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
            Password reset successful.
          </div>
        ) : null}
      </form>
      ) : (
        <div className="mt-6 space-y-4">
          <div
            role="status"
            className="rounded-xl border border-[rgba(62,138,118,0.24)] bg-[rgba(62,138,118,0.08)] px-4 py-3 text-sm text-[#0F1F1A]"
          >
            Reset links include a token. Request a new reset link to continue.
          </div>
          <a
            href="/forgot-password"
            className="inline-flex w-full items-center justify-center rounded-none [border-radius:0!important] bg-[#3E8A76] px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[#357563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Request reset link
          </a>
          <p className="text-[11px] leading-5 text-[rgba(75,90,83,0.7)]">
            Back to{" "}
            <a href="/login" className="font-semibold text-[#3E8A76] hover:underline underline-offset-4">
              sign in
            </a>
            .
          </p>
        </div>
      )}
    </div>
  )
}

