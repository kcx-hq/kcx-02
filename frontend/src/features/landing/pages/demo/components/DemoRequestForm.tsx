import {
  useId,
  useMemo,
  useState,
  type FocusEvent,
  type FormEvent,
  type HTMLAttributes,
} from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { validateForm } from "@/lib/validateForm"
import { scheduleDemoSchema } from "@/schemas/demo.schema"

type DemoFormState = {
  firstName: string
  lastName: string
  companyName: string
  companyEmail: string
  discovery: string
  discoveryOther: string
}

type DemoTouched = Partial<Record<keyof DemoFormState, boolean>>
type DemoErrors = Partial<Record<keyof DemoFormState, string>>

const DISCOVERY_OPTIONS = [
  { value: "", label: "Select an option" },
  { value: "referral", label: "Referral" },
  { value: "community", label: "FinOps community" },
  { value: "search", label: "Search" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
] as const

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold tracking-[-0.01em]">
      {children}
    </label>
  )
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="mt-1 text-xs text-red-600">
      {children}
    </p>
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
  tone,
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
  tone?: "light" | "dark"
  invalid?: boolean
  errorId?: string
}) {
  const isLight = tone === "light"
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
            "h-11 w-full rounded-xl border px-3 text-sm transition duration-200 focus-visible:outline-none",
            isLight
              ? "bg-white text-[#0F1F1A] placeholder:text-[rgba(75,90,83,0.55)]"
              : "bg-[rgba(5,11,17,0.42)] text-white placeholder:text-[rgba(214,230,226,0.45)] backdrop-blur-sm",
            invalid
              ? "border-red-500/70 focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/15"
              : isLight
                ? "border-[rgba(21,37,49,0.16)] focus-visible:border-[rgba(62,138,118,0.55)] focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.22)]"
                : "border-[rgba(226,240,236,0.18)] focus-visible:border-[rgba(189,255,233,0.6)] focus-visible:ring-2 focus-visible:ring-[rgba(96,191,163,0.45)]"
          )}
        />
      </div>
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  onBlur,
  options,
  required,
  tone,
  invalid,
  errorId,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  onBlur?: (event: FocusEvent<HTMLSelectElement>) => void
  options: readonly { value: string; label: string }[]
  required?: boolean
  tone?: "light" | "dark"
  invalid?: boolean
  errorId?: string
}) {
  const isLight = tone === "light"
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="mt-2">
        <select
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          required={required}
          aria-invalid={invalid ? "true" : "false"}
          aria-describedby={errorId}
          className={cn(
            "h-11 w-full appearance-none rounded-xl border px-3 pr-10 text-sm transition duration-200 focus-visible:outline-none",
            isLight ? "bg-white text-[#0F1F1A]" : "bg-[rgba(5,11,17,0.42)] text-white backdrop-blur-sm",
            invalid
              ? "border-red-500/70 focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/15"
              : isLight
                ? "border-[rgba(21,37,49,0.16)] focus-visible:border-[rgba(62,138,118,0.55)] focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.22)]"
                : "border-[rgba(226,240,236,0.18)] focus-visible:border-[rgba(189,255,233,0.6)] focus-visible:ring-2 focus-visible:ring-[rgba(96,191,163,0.45)]"
          )}
        >
          {options.map((option) => (
            <option key={option.value || option.label} value={option.value} disabled={option.value === ""}>
              {option.label}
            </option>
          ))}
        </select>
        <div
          className={cn(
            "pointer-events-none relative -mt-11 flex h-11 items-center justify-end pr-3",
            isLight ? "text-[rgba(75,90,83,0.7)]" : "text-[rgba(214,230,226,0.55)]"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 10l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

export function DemoRequestForm({
  tone = "dark",
  chrome = "card",
}: {
  tone?: "light" | "dark"
  chrome?: "card" | "none"
}) {
  const formId = useId()
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<DemoFormState>({
    firstName: "",
    lastName: "",
    companyName: "",
    companyEmail: "",
    discovery: "",
    discoveryOther: "",
  })
  const [touched, setTouched] = useState<DemoTouched>({})
  const [errors, setErrors] = useState<DemoErrors>({})

  const parsed = useMemo(() => scheduleDemoSchema.safeParse(form as unknown), [form])
  const isValid = parsed.success

  function validateAndSet(nextValues: DemoFormState) {
    const result = validateForm(scheduleDemoSchema, nextValues)
    if (result.success) {
      setErrors({})
      return true
    }
    setErrors(result.errors as DemoErrors)
    return false
  }

  function validateField(field: keyof DemoFormState, nextValues: DemoFormState) {
    const result = validateForm(scheduleDemoSchema, nextValues)
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
    setTouched({
      firstName: true,
      lastName: true,
      companyName: true,
      companyEmail: true,
      discovery: true,
      discoveryOther: true,
    })
    const ok = validateAndSet(form)
    if (!ok) return

    setSubmitted(true)
  }

  const isLight = tone === "light"
  const isCard = chrome === "card"
  const chromeClassName = isCard
    ? cn(
        "rounded-[20px] border p-6 sm:p-7",
        isLight ? "border-[rgba(21,37,49,0.12)] bg-white" : "kcx-surface-card-dark"
      )
    : undefined

  return (
    <div className={chromeClassName}>
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.22em]",
          isLight ? "text-[#3E8A76]" : "text-[rgba(170,225,207,0.92)]"
        )}
      >
        Request demo
      </p>
      <h2
        className={cn(
          "mt-3 text-balance text-[1.35rem] font-semibold leading-[1.1] tracking-[-0.03em]",
          isLight ? "text-[#0F1F1A]" : "text-white"
        )}
      >
        Tell us a bit about you
      </h2>
      <p className={cn("mt-3 text-sm leading-7", isLight ? "text-[rgba(75,90,83,0.9)]" : "text-[rgba(214,230,226,0.82)]")}>
        We'll reach out to schedule a quick walkthrough.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <TextField
              id={`${formId}-firstName`}
              label="First Name"
              value={form.firstName}
              onChange={(next) => {
                const nextValues = { ...form, firstName: next }
                setForm(nextValues)
                if (touched.firstName) validateField("firstName", nextValues)
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, firstName: true }))
                validateField("firstName", form)
              }}
              autoComplete="given-name"
              required
              placeholder="Ava"
              tone={tone}
              invalid={touched.firstName && Boolean(errors.firstName)}
              errorId={errors.firstName ? `${formId}-firstName__error` : undefined}
            />
            {touched.firstName && errors.firstName ? (
              <FieldError id={`${formId}-firstName__error`}>{errors.firstName}</FieldError>
            ) : null}
          </div>

          <div>
            <TextField
              id={`${formId}-lastName`}
              label="Last Name"
              value={form.lastName}
              onChange={(next) => {
                const nextValues = { ...form, lastName: next }
                setForm(nextValues)
                if (touched.lastName) validateField("lastName", nextValues)
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, lastName: true }))
                validateField("lastName", form)
              }}
              autoComplete="family-name"
              required
              placeholder="Jordan"
              tone={tone}
              invalid={touched.lastName && Boolean(errors.lastName)}
              errorId={errors.lastName ? `${formId}-lastName__error` : undefined}
            />
            {touched.lastName && errors.lastName ? (
              <FieldError id={`${formId}-lastName__error`}>{errors.lastName}</FieldError>
            ) : null}
          </div>
        </div>

        <div>
          <TextField
            id={`${formId}-companyEmail`}
            label="Company Email"
            value={form.companyEmail}
            onChange={(next) => {
              const nextValues = { ...form, companyEmail: next }
              setForm(nextValues)
              if (touched.companyEmail) validateField("companyEmail", nextValues)
            }}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, companyEmail: true }))
              validateField("companyEmail", form)
            }}
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="ava@company.com"
            tone={tone}
            invalid={touched.companyEmail && Boolean(errors.companyEmail)}
            errorId={errors.companyEmail ? `${formId}-companyEmail__error` : undefined}
          />
          {touched.companyEmail && errors.companyEmail ? (
            <FieldError id={`${formId}-companyEmail__error`}>{errors.companyEmail}</FieldError>
          ) : null}
        </div>

        <div>
          <TextField
            id={`${formId}-companyName`}
            label="Company Name"
            value={form.companyName}
            onChange={(next) => {
              const nextValues = { ...form, companyName: next }
              setForm(nextValues)
              if (touched.companyName) validateField("companyName", nextValues)
            }}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, companyName: true }))
              validateField("companyName", form)
            }}
            autoComplete="organization"
            required
            placeholder="KCX Labs"
            tone={tone}
            invalid={touched.companyName && Boolean(errors.companyName)}
            errorId={errors.companyName ? `${formId}-companyName__error` : undefined}
          />
          {touched.companyName && errors.companyName ? (
            <FieldError id={`${formId}-companyName__error`}>{errors.companyName}</FieldError>
          ) : null}
        </div>

        <div>
          <SelectField
            id={`${formId}-discovery`}
            label="Where did you hear about us?"
            value={form.discovery}
            onChange={(next) => {
              const nextValues = {
                ...form,
                discovery: next,
                discoveryOther: next === "other" ? form.discoveryOther : "",
              }
              setForm(nextValues)
              if (touched.discovery) validateField("discovery", nextValues)
            }}
            onBlur={() => {
              setTouched((prev) => ({ ...prev, discovery: true }))
              validateField("discovery", form)
            }}
            required
            options={DISCOVERY_OPTIONS}
            tone={tone}
            invalid={touched.discovery && Boolean(errors.discovery)}
            errorId={errors.discovery ? `${formId}-discovery__error` : undefined}
          />
          {touched.discovery && errors.discovery ? (
            <FieldError id={`${formId}-discovery__error`}>{errors.discovery}</FieldError>
          ) : null}
        </div>

        {form.discovery === "other" ? (
          <div>
            <TextField
              id={`${formId}-discoveryOther`}
              label="Other"
              value={form.discoveryOther}
              onChange={(next) => {
                const nextValues = { ...form, discoveryOther: next }
                setForm(nextValues)
                if (touched.discoveryOther) validateField("discoveryOther", nextValues)
              }}
              onBlur={() => {
                setTouched((prev) => ({ ...prev, discoveryOther: true }))
                validateField("discoveryOther", form)
              }}
              required
              placeholder="Please specify"
              tone={tone}
              invalid={touched.discoveryOther && Boolean(errors.discoveryOther)}
              errorId={errors.discoveryOther ? `${formId}-discoveryOther__error` : undefined}
            />
            {touched.discoveryOther && errors.discoveryOther ? (
              <FieldError id={`${formId}-discoveryOther__error`}>{errors.discoveryOther}</FieldError>
            ) : null}
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={!isValid}
          className={cn(
            "mt-2 h-11 w-full rounded-xl text-sm font-semibold transition duration-200",
            isLight
              ? "bg-[#3E8A76] text-white hover:bg-[#357563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              : "border border-[rgba(189,255,233,0.55)] bg-[linear-gradient(135deg,rgba(96,191,163,0.95)_0%,rgba(79,165,142,0.9)_52%,rgba(70,142,188,0.8)_100%)] text-[#06111b] shadow-[0_16px_38px_rgba(72,169,145,0.18)] hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-[0_18px_48px_rgba(72,169,145,0.26)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(96,191,163,0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06101a] motion-reduce:transform-none",
            !isValid ? "cursor-not-allowed opacity-55 hover:scale-100 hover:-translate-y-0" : null
          )}
        >
          Request Demo
        </Button>

        <p className={cn("text-[11px] leading-5", isLight ? "text-[rgba(75,90,83,0.7)]" : "text-[rgba(214,230,226,0.6)]")}>
          By submitting, you agree to be contacted about KCX.
        </p>

        {submitted ? (
          <div
            role="status"
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              isLight
                ? "border-[rgba(62,138,118,0.24)] bg-[rgba(62,138,118,0.08)] text-[#0F1F1A]"
                : "border-[rgba(163,247,221,0.22)] bg-[rgba(62,138,118,0.12)] text-[rgba(230,244,240,0.86)]"
            )}
          >
            Thanks — we'll reach out shortly to confirm a time.
          </div>
        ) : null}
      </form>
    </div>
  )
}
