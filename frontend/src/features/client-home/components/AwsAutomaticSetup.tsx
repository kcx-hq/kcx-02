import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ApiError, apiPost } from "@/lib/api"
import { cn } from "@/lib/utils"

type AwsAutomaticSetupProps = {
  activeRoute: string
}

type AccountType = "payer" | "member"

type CloudConnectionCreateResponse = {
  id: string
}

type AwsCloudFormationSetupPayload = {
  region: string
  enableEC2Module: boolean
  enableCloudTrail: boolean
  useTagScopedAccess: boolean
  resourceTagKey?: string
  resourceTagValue?: string
  accountType: AccountType
}

type ApiErrorPayload = {
  message?: string
  error?: {
    code?: string
  }
}

type FormState = {
  connectionName: string
  accountType: AccountType
}

type FormErrors = Partial<Record<"connectionName", string>>

const DEFAULT_AWS_REGION = "us-east-1"

const FIELD_LABEL_CLASS = "text-[18px] font-semibold text-text-secondary"
const FIELD_CONTROL_CLASS =
  "h-12 w-full border-0 border-b border-[color:var(--border-light)] bg-transparent px-0 text-[16px] text-text-primary outline-none transition-colors placeholder:text-text-muted hover:border-[color:var(--kcx-border-strong)] focus:border-[color:var(--brand-primary)] sm:text-[18px]"

function validateForm(input: {
  connectionName: string
}): FormErrors {
  const errors: FormErrors = {}

  if (!input.connectionName.trim()) {
    errors.connectionName = "Connection Name is required."
  }

  return errors
}

function isDuplicateCloudConnectionError(error: ApiError): boolean {
  const payload = error.payload && typeof error.payload === "object"
    ? (error.payload as ApiErrorPayload)
    : null
  const code = payload?.error?.code
  if (error.status === 409 && code === "DUPLICATE_CLOUD_CONNECTION") return true
  return Boolean(error.message && error.message.toLowerCase().includes("already connected"))
}

export function AwsAutomaticSetup({ activeRoute }: AwsAutomaticSetupProps) {
  void activeRoute
  const initialFormState: FormState = {
    connectionName: "",
    accountType: "payer",
  }

  const [form, setForm] = useState<FormState>({
    ...initialFormState,
  })
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const normalizedConnectionName = form.connectionName.trim()

  const formErrors = useMemo(
    () =>
      validateForm({
        connectionName: normalizedConnectionName,
      }),
    [normalizedConnectionName],
  )

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  function onClearForm() {
    setForm(initialFormState)
    setHasSubmitted(false)
    setSubmitError(null)
  }

  function onSubmitAutomaticSetup() {
    setHasSubmitted(true)
    setSubmitError(null)
    if (Object.keys(formErrors).length > 0) return

    const setupTab = window.open("about:blank", "_blank")
    setIsSubmitting(true)

    void (async () => {
      try {
        const created = await apiPost<CloudConnectionCreateResponse>("/cloud-connections", {
          connection_name: normalizedConnectionName,
          provider: "aws",
          status: "draft",
          account_type: form.accountType,
        })

        const payload: AwsCloudFormationSetupPayload = {
          region: DEFAULT_AWS_REGION,
          enableEC2Module: true,
          enableCloudTrail: true,
          useTagScopedAccess: false,
          accountType: form.accountType,
        }

        const setup = await apiPost<{ url: string }>(`/cloud-connections/${created.id}/aws-cloudformation-url`, payload)
        if (setupTab) {
          setupTab.opener = null
          setupTab.location.href = setup.url
        } else {
          window.open(setup.url, "_blank", "noopener,noreferrer")
        }
      } catch (error) {
        if (setupTab && !setupTab.closed) {
          setupTab.close()
        }

        if (error instanceof ApiError) {
          if (isDuplicateCloudConnectionError(error)) {
            setSubmitError("This AWS account is already connected in KCX.")
            return
          }
          setSubmitError(error.message || "Failed to generate AWS setup link.")
          return
        }

        setSubmitError(error instanceof Error ? error.message : "Failed to generate AWS setup link.")
      } finally {
        setIsSubmitting(false)
      }
    })()
  }

  return (
    <div className="w-full max-w-[980px] space-y-6">
      <section className="max-w-[1040px] space-y-6 text-[16px] leading-[1.6] text-text-secondary md:text-[17px]">
        <div className="space-y-3">
          <p>
            KCX launches a guided AWS onboarding using CloudFormation so your billing and usage discovery can be configured in one flow.
          </p>
          <p>
            When you select <span className="font-semibold text-text-primary">Save & Continue,</span> we open AWS Console in a new tab to
            deploy the stack with your account permissions.
          </p>
          <p>
            For full setup steps, open{" "}
            <a
              href="/integrations/aws"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[color:var(--brand-primary)] underline underline-offset-4"
            >
              Automatically Connecting to AWS
            </a>.
          </p>
        </div>

        <div className="space-y-3">
          <p className="font-semibold text-text-primary">KCX automatic defaults</p>
          <ul className="list-disc space-y-2 pl-7">
            <li>Deploys the AWS integration stack in region <span className="font-semibold text-text-primary">{DEFAULT_AWS_REGION}</span>.</li>
            <li>Enables CloudTrail and EC2 modules by default for complete billing and usage visibility.</li>
          </ul>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
        <label className="space-y-2">
          <span className={FIELD_LABEL_CLASS}>Connection Name</span>
          <input
            className={cn(
              FIELD_CONTROL_CLASS,
              hasSubmitted && formErrors.connectionName ? "border-rose-300" : "border-[color:var(--border-light)]",
            )}
            placeholder="e.g. prod-aws-account"
            value={form.connectionName}
            onChange={(event) => setField("connectionName", event.target.value)}
          />
          {hasSubmitted && formErrors.connectionName ? (
            <p className="text-xs text-rose-600">{formErrors.connectionName}</p>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className={FIELD_LABEL_CLASS}>Account Type</span>
          <select
            className={cn(FIELD_CONTROL_CLASS, "pr-8")}
            value={form.accountType}
            onChange={(event) => setField("accountType", event.target.value as AccountType)}
          >
            <option value="payer">Payer Account</option>
            <option value="member">Member Account</option>
          </select>
        </label>

      </div>

      {submitError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--border-light)] pt-5">
        <button
          type="button"
          onClick={onClearForm}
          className="h-10 rounded-md px-4 text-base font-semibold text-text-secondary transition-colors hover:text-text-primary"
          disabled={isSubmitting}
        >
          Clear Form
        </button>
        <Button className="h-10 rounded-md px-5 text-base font-semibold" disabled={isSubmitting} onClick={onSubmitAutomaticSetup}>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating Setup Link...
            </span>
          ) : (
            "Save & Continue"
          )}
        </Button>
      </div>
    </div>
  )
}
