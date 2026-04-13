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
  region: string
  accountType: AccountType
  enableEC2Module: boolean
  enableCloudTrail: boolean
  useTagScopedAccess: boolean
  resourceTagKey: string
  resourceTagValue: string
}

type FormErrors = Partial<Record<"connectionName" | "region" | "resourceTagKey" | "resourceTagValue", string>>

const AWS_REGION_OPTIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "eu-west-1",
  "eu-central-1",
  "eu-west-2",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
]

const SECTION_TITLE_CLASS = "text-sm font-semibold uppercase tracking-[0.08em] text-brand-primary"
const LABEL_CLASS = "text-[13px] font-semibold uppercase tracking-[0.06em] text-text-secondary"
const REQUIRED_ASTERISK_CLASS = "ml-1 text-[13px] font-semibold text-brand-primary"
const CONTROL_CLASS =
  "h-[34px] w-full rounded-[7px] border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors hover:border-[color:var(--kcx-border-strong)] focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-soft)]"

function validateForm(input: {
  connectionName: string
  region: string
  useTagScopedAccess: boolean
  resourceTagKey: string
  resourceTagValue: string
}): FormErrors {
  const errors: FormErrors = {}

  if (!input.connectionName.trim()) {
    errors.connectionName = "Connection Name is required."
  }

  if (!input.region.trim()) {
    errors.region = "Region is required."
  }

  if (input.useTagScopedAccess && !input.resourceTagKey.trim()) {
    errors.resourceTagKey = "Resource Tag Key is required when tag scoped access is enabled."
  }

  if (input.useTagScopedAccess && !input.resourceTagValue.trim()) {
    errors.resourceTagValue = "Resource Tag Value is required when tag scoped access is enabled."
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
  const [form, setForm] = useState<FormState>({
    connectionName: "",
    region: "us-east-1",
    accountType: "payer",
    enableEC2Module: true,
    enableCloudTrail: false,
    useTagScopedAccess: false,
    resourceTagKey: "",
    resourceTagValue: "",
  })
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const normalizedConnectionName = form.connectionName.trim()

  const formErrors = useMemo(
    () =>
      validateForm({
        connectionName: normalizedConnectionName,
        region: form.region,
        useTagScopedAccess: form.useTagScopedAccess,
        resourceTagKey: form.resourceTagKey,
        resourceTagValue: form.resourceTagValue,
      }),
    [
      form.region,
      form.resourceTagKey,
      form.resourceTagValue,
      form.useTagScopedAccess,
      normalizedConnectionName,
    ],
  )

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [field]: value }))
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
          region: form.region,
          enableEC2Module: form.enableEC2Module,
          enableCloudTrail: form.enableCloudTrail,
          useTagScopedAccess: form.useTagScopedAccess,
          accountType: form.accountType,
          ...(form.useTagScopedAccess ? { resourceTagKey: form.resourceTagKey.trim() } : {}),
          ...(form.useTagScopedAccess ? { resourceTagValue: form.resourceTagValue.trim() } : {}),
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
    <>
      <div className="w-full max-w-[860px] space-y-4">
        <section className="space-y-2.5">
          <p className={SECTION_TITLE_CLASS}>Basic Connection Info</p>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <label className="space-y-1 md:col-span-2">
              <span className={LABEL_CLASS}>
                Connection Name
                <span className={REQUIRED_ASTERISK_CLASS}>*</span>
              </span>
              <input
                className={cn(
                  CONTROL_CLASS,
                  hasSubmitted && formErrors.connectionName ? "border-rose-300" : "border-[color:var(--border-light)]",
                )}
                placeholder="prod-aws-account"
                value={form.connectionName}
                onChange={(event) => setField("connectionName", event.target.value)}
              />
              {hasSubmitted && formErrors.connectionName ? (
                <p className="text-xs text-rose-600">{formErrors.connectionName}</p>
              ) : null}
            </label>

            <label className="space-y-1">
              <span className={LABEL_CLASS}>
                Region
                <span className={REQUIRED_ASTERISK_CLASS}>*</span>
              </span>
              <select
                className={cn(
                  CONTROL_CLASS,
                  hasSubmitted && formErrors.region ? "border-rose-300" : "border-[color:var(--border-light)]",
                )}
                value={form.region}
                onChange={(event) => setField("region", event.target.value)}
              >
                {AWS_REGION_OPTIONS.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
              {hasSubmitted && formErrors.region ? <p className="text-xs text-rose-600">{formErrors.region}</p> : null}
            </label>

            <fieldset className="space-y-1">
              <legend className={LABEL_CLASS}>
                Account Type
                <span className={REQUIRED_ASTERISK_CLASS}>*</span>
              </legend>
              <div className="space-y-0.5 rounded-[7px] border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-1.5">
                <label className="flex items-center gap-2 rounded-sm px-1.5 py-0.5 text-sm text-text-primary transition-colors hover:bg-white">
                  <input
                    type="radio"
                    name="aws-account-type"
                    value="payer"
                    checked={form.accountType === "payer"}
                    onChange={() => setField("accountType", "payer")}
                    className="h-4 w-4 accent-[color:var(--brand-primary)]"
                  />
                  <span>Payer Account</span>
                </label>
                <label className="flex items-center gap-2 rounded-sm px-1.5 py-0.5 text-sm text-text-primary transition-colors hover:bg-white">
                  <input
                    type="radio"
                    name="aws-account-type"
                    value="member"
                    checked={form.accountType === "member"}
                    onChange={() => setField("accountType", "member")}
                    className="h-4 w-4 accent-[color:var(--brand-primary)]"
                  />
                  <span>Member Account</span>
                </label>
              </div>
            </fieldset>
          </div>
        </section>

        <section className="space-y-2.5 border-t border-[color:var(--border-light)] pt-4">
          <p className={SECTION_TITLE_CLASS}>Optional Modules</p>
          <div className="space-y-1">
            <label className="flex items-center gap-2 rounded-[7px] px-2 py-1 text-sm text-text-primary transition-colors hover:bg-[color:var(--bg-surface)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--brand-primary)]"
                checked={form.enableCloudTrail}
                onChange={(event) => setField("enableCloudTrail", event.target.checked)}
              />
              <span className="font-medium">Enable CloudTrail</span>
            </label>
            <label className="flex items-center gap-2 rounded-[7px] px-2 py-1 text-sm text-text-primary transition-colors hover:bg-[color:var(--bg-surface)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--brand-primary)]"
                checked={form.enableEC2Module}
                onChange={(event) => setField("enableEC2Module", event.target.checked)}
              />
              <span className="font-medium">Enable EC2 Module</span>
            </label>
          </div>
        </section>

        <section className="space-y-2.5 border-t border-[color:var(--border-light)] pt-4">
          <p className={SECTION_TITLE_CLASS}>Tag Scoped Access</p>
          <label className="flex items-center gap-2 rounded-[7px] px-2 py-1 text-sm text-text-primary transition-colors hover:bg-[color:var(--bg-surface)]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[color:var(--brand-primary)]"
              checked={form.useTagScopedAccess}
              onChange={(event) => setField("useTagScopedAccess", event.target.checked)}
            />
            <span className="font-medium">Use minimal tag access</span>
          </label>

          {form.useTagScopedAccess ? (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <label className="space-y-1">
                <span className={LABEL_CLASS}>
                  Resource Tag Key
                  <span className={REQUIRED_ASTERISK_CLASS}>*</span>
                </span>
                <input
                  className={cn(
                    CONTROL_CLASS,
                    hasSubmitted && formErrors.resourceTagKey ? "border-rose-300" : "border-[color:var(--border-light)]",
                  )}
                  placeholder="Environment"
                  value={form.resourceTagKey}
                  onChange={(event) => setField("resourceTagKey", event.target.value)}
                />
                {hasSubmitted && formErrors.resourceTagKey ? (
                  <p className="text-xs text-rose-600">{formErrors.resourceTagKey}</p>
                ) : null}
              </label>

              <label className="space-y-1">
                <span className={LABEL_CLASS}>
                  Resource Tag Value
                  <span className={REQUIRED_ASTERISK_CLASS}>*</span>
                </span>
                <input
                  className={cn(
                    CONTROL_CLASS,
                    hasSubmitted && formErrors.resourceTagValue ? "border-rose-300" : "border-[color:var(--border-light)]",
                  )}
                  placeholder="Production"
                  value={form.resourceTagValue}
                  onChange={(event) => setField("resourceTagValue", event.target.value)}
                />
                {hasSubmitted && formErrors.resourceTagValue ? (
                  <p className="text-xs text-rose-600">{formErrors.resourceTagValue}</p>
                ) : null}
              </label>
            </div>
          ) : null}
        </section>

        {submitError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--border-light)] pt-2.5">
          <Button className="h-9 rounded-md px-4" disabled={isSubmitting} onClick={onSubmitAutomaticSetup}>
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Setup Link...
              </span>
            ) : (
              "Generate AWS Setup Link"
            )}
          </Button>
        </div>
      </div>
    </>
  )
}
