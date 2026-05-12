import { useId, useMemo, useState, type FocusEvent, type FormEvent, type HTMLAttributes } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { validateForm } from "@/lib/validateForm"
import { apiPost, ApiError } from "@/lib/api"
import { navigateTo } from "@/lib/navigation"
import { setAuthSession, type AuthUser } from "@/lib/auth"
import { loginSchema, type LoginValues } from "@/schemas/auth.schema"

type LoginTouched = Partial<Record<keyof LoginValues, boolean>>

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-semibold leading-none tracking-[-0.01em] text-[rgba(63,80,75,0.94)]"
    >
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

export function LoginForm() {
  const formId = useId()
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [form, setForm] = useState<LoginValues>({ email: "", password: "" })
  const [touched, setTouched] = useState<LoginTouched>({})
  const [errors, setErrors] = useState<Partial<Record<keyof LoginValues, string>>>({})

  const parsed = useMemo(() => loginSchema.safeParse(form), [form])
  const isValid = parsed.success

  function validateAndSet(nextValues: LoginValues) {
    const result = validateForm(loginSchema, nextValues)
    if (result.success) {
      setErrors({})
      return true
    }
    setErrors(result.errors as Partial<Record<keyof LoginValues, string>>)
    return false
  }

  function validateField(field: keyof LoginValues, nextValues: LoginValues) {
    const result = validateForm(loginSchema, nextValues)
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
    setTouched({ email: true, password: true })
    const ok = validateAndSet(form)
    if (!ok) return

    setApiError(null)
    setSubmitting(true)
    void (async () => {
      try {
        type LoginResponse = {
          token: string
          expiresAt: string
          user: {
            id: number | string
            email: string
            fullName?: string
            firstName?: string
            lastName?: string
            companyName?: string | null
            tenant?: { id: string; name: string; slug: string } | null
            role: string
            status: string
            source?: string
          }
        }

        const data = await apiPost<LoginResponse>("/auth/login", {
          email: form.email,
          password: form.password,
        })
        const fullName = (data.user.fullName ?? "").trim()
        const nameParts = fullName.split(/\s+/).filter(Boolean)
        const firstName = (data.user.firstName ?? nameParts[0] ?? "").trim()
        const lastName = (data.user.lastName ?? nameParts.slice(1).join(" ") ?? "").trim()

        const normalizedUser: AuthUser = {
          id: data.user.id,
          email: data.user.email,
          firstName,
          lastName,
          companyName: data.user.companyName ?? data.user.tenant?.name ?? null,
          tenantSlug: data.user.tenant?.slug ?? null,
          role: data.user.role,
          status: data.user.status,
          source: data.user.source ?? "auth",
        }

        setAuthSession({ token: data.token, user: normalizedUser, expiresAt: data.expiresAt })
        navigateTo("/client/overview")
      } catch (error) {
        if (error instanceof ApiError) {
          setApiError(error.message || "Login failed")
          return
        }
        setApiError("Login failed")
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <div>
      <h2 className="text-balance text-[1.7rem] font-semibold leading-[1.08] tracking-[-0.03em] text-[#13222a]">
        Login
      </h2>
      <p className="mt-3 text-sm leading-6 text-[rgba(82,99,106,0.9)]">Sign in to your KCX account.</p>

      <form className="mt-8 space-y-8" onSubmit={onSubmit} aria-describedby={`${formId}__help`}>
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

        <TextField
          id={`${formId}-password`}
          label="Password"
          value={form.password}
          onChange={(next) => {
            const nextValues = { ...form, password: next }
            setForm(nextValues)
            if (touched.password) validateField("password", nextValues)
          }}
          onBlur={() => {
            setTouched((prev) => ({ ...prev, password: true }))
            validateField("password", form)
          }}
          type="password"
          autoComplete="current-password"
          required
          placeholder="Enter password"
          invalid={touched.password && Boolean(errors.password)}
          errorId={errors.password ? `${formId}-password__error` : undefined}
        />
        {touched.password && errors.password ? (
          <p id={`${formId}-password__error`} className="text-xs text-red-600">
            {errors.password}
          </p>
        ) : null}

        <div className="flex items-center justify-end">
          <a
            href="/forgot-password"
            className="text-xs font-semibold text-[#3E8A76] underline-offset-4 hover:text-[#357563] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.22)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Reset password
          </a>
        </div>

        <Button
          type="submit"
          disabled={!isValid || submitting}
          className={cn(
            "mt-2 h-11 w-full rounded-none [border-radius:0!important] bg-[#3E8A76] text-sm font-semibold text-white transition duration-200 hover:bg-[#357563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
            !isValid || submitting ? "cursor-not-allowed opacity-55 hover:bg-[#3E8A76]" : null
          )}
        >
          {submitting ? "Signing In..." : "Sign In"}
        </Button>

        <p id={`${formId}__help`} className="text-[11px] leading-5 text-[rgba(75,90,83,0.7)]">
          Need access?{" "}
          <a href="/schedule-demo" className="font-semibold text-[#3E8A76] hover:underline underline-offset-4">
            Request a demo
          </a>
          .
        </p>

        {apiError ? (
          <div
            role="status"
            className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-[#0F1F1A]"
          >
            {apiError}
          </div>
        ) : null}
      </form>
    </div>
  )
}
