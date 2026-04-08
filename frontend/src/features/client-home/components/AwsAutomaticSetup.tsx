import { useMemo, useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ApiError, apiPost } from "@/lib/api"
import { navigateTo } from "@/lib/navigation"
import { cn } from "@/lib/utils"

type AwsAutomaticSetupProps = {
  activeRoute: string
}

type AccountType = "payer" | "member"

type CloudConnectionCreateResponse = {
  id: string
  stack_name?: string | null
  external_id?: string | null
  callback_token?: string | null
  callback_url?: string | null
}

type AwsCloudFormationSetupPayload = {
  stackName: string
  externalId: string
  connectionName: string
  region: string
  exportPrefix?: string
  exportName?: string
  callbackUrl?: string
  callbackToken?: string
  enableBillingExport: boolean
  enableActionRole: boolean
  enableEC2Module: boolean
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
  stackName: string
  enableBillingExport: boolean
  enableActionRole: boolean
  enableEC2Module: boolean
  useTagScopedAccess: boolean
  resourceTagKey: string
  resourceTagValue: string
  exportPrefix: string
  exportName: string
}

type FormErrors = Partial<Record<"connectionName" | "region" | "stackName" | "resourceTagKey" | "resourceTagValue", string>>

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

const DEFAULT_EXPORT_PREFIX = "kcx/data-exports/cur2"
const DEFAULT_STACK_FALLBACK = "kcx-aws-setup"

function toSlugSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function buildGeneratedStackName(connectionName: string) {
  const normalized = toSlugSegment(connectionName)
  const base = normalized.length > 0 ? normalized : DEFAULT_STACK_FALLBACK
  const prefixed = base.startsWith("kcx-") ? base : `kcx-${base}`
  return prefixed.slice(0, 128)
}

function validateForm(input: {
  connectionName: string
  region: string
  stackName: string
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

  if (!input.stackName.trim()) {
    errors.stackName = "Stack Name is required."
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

type SetupModuleCardProps = {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  disabledReason?: string
}

function SetupModuleCard({
  title,
  description,
  checked,
  onChange,
  disabled = false,
  disabledReason,
}: SetupModuleCardProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        checked
          ? "border-[color:var(--kcx-border-strong)] bg-[color:var(--brand-soft)]"
          : "border-[color:var(--border-light)] bg-white",
        disabled ? "cursor-not-allowed opacity-60" : "hover:border-[color:var(--kcx-border-strong)]"
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-[color:var(--brand-primary)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="text-xs text-text-secondary">{description}</p>
        {disabledReason ? <p className="text-xs text-text-muted">{disabledReason}</p> : null}
      </div>
    </label>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--border-light)] py-2 last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  )
}

export function AwsAutomaticSetup({ activeRoute }: AwsAutomaticSetupProps) {
  const [form, setForm] = useState<FormState>({
    connectionName: "",
    region: "us-east-1",
    accountType: "payer",
    stackName: "",
    enableBillingExport: true,
    enableActionRole: true,
    enableEC2Module: true,
    useTagScopedAccess: false,
    resourceTagKey: "",
    resourceTagValue: "",
    exportPrefix: DEFAULT_EXPORT_PREFIX,
    exportName: "",
  })
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const awsBaseRoute = activeRoute.startsWith("/client/billing/connections/")
    ? "/client/billing/connections/aws"
    : "/client/billing/connect-cloud/aws"

  const normalizedConnectionName = form.connectionName.trim()
  const generatedStackName = useMemo(
    () => buildGeneratedStackName(normalizedConnectionName),
    [normalizedConnectionName],
  )
  const effectiveStackName = form.stackName.trim() || generatedStackName
  const effectiveEnableEC2Module = form.enableActionRole ? form.enableEC2Module : false
  const hasCustomStackName = form.stackName.trim().length > 0

  const formErrors = useMemo(
    () =>
      validateForm({
        connectionName: normalizedConnectionName,
        region: form.region,
        stackName: effectiveStackName,
        useTagScopedAccess: form.useTagScopedAccess,
        resourceTagKey: form.resourceTagKey,
        resourceTagValue: form.resourceTagValue,
      }),
    [
      effectiveStackName,
      form.region,
      form.resourceTagKey,
      form.resourceTagValue,
      form.useTagScopedAccess,
      normalizedConnectionName,
    ],
  )

  const selectedModules = [
    form.enableBillingExport ? "Billing Export" : null,
    form.enableActionRole ? "Action Role" : null,
    effectiveEnableEC2Module ? "EC2 Module" : null,
  ].filter((item): item is string => Boolean(item))

  const tagScopeSummary = form.useTagScopedAccess
    ? `${form.resourceTagKey.trim() || "tagKey"} = ${form.resourceTagValue.trim() || "tagValue"}`
    : "No tag constraint"

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

        const externalId = created.external_id?.trim()
        const callbackToken = created.callback_token?.trim()
        const callbackUrl = created.callback_url?.trim()

        if (!externalId) {
          throw new Error("Missing externalId from connection setup.")
        }

        if (form.enableBillingExport && (!callbackToken || !callbackUrl)) {
          throw new Error("Billing Export callback configuration is missing.")
        }

        const payload: AwsCloudFormationSetupPayload = {
          stackName: effectiveStackName,
          externalId,
          connectionName: normalizedConnectionName,
          region: form.region,
          enableBillingExport: form.enableBillingExport,
          enableActionRole: form.enableActionRole,
          enableEC2Module: effectiveEnableEC2Module,
          useTagScopedAccess: form.useTagScopedAccess,
          accountType: form.accountType,
          ...(form.exportPrefix.trim() ? { exportPrefix: form.exportPrefix.trim() } : {}),
          ...(form.exportName.trim() ? { exportName: form.exportName.trim() } : {}),
          ...(form.enableBillingExport && callbackUrl ? { callbackUrl } : {}),
          ...(form.enableBillingExport && callbackToken ? { callbackToken } : {}),
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
      <div className="space-y-2">
        <p className="kcx-eyebrow text-brand-primary">AWS Automatic Setup</p>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Guided AWS Setup</h2>
        <p className="text-sm text-text-secondary">
          Configure modules, permission scope, and deployment details before generating the CloudFormation link.
        </p>
      </div>

      <div className="space-y-4">
        <section className="space-y-4 rounded-xl border border-[color:var(--border-light)] bg-white p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-primary">Section 1 - Basic Connection Info</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                Connection Name
                <span className="ml-2 text-[11px] text-brand-primary">Required</span>
              </span>
              <input
                className={cn(
                  "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]",
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

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                Region
                <span className="ml-2 text-[11px] text-brand-primary">Required</span>
              </span>
              <select
                className={cn(
                  "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]",
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

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                Account Type
                <span className="ml-2 text-[11px] text-brand-primary">Required</span>
              </legend>
              <div className="space-y-2 rounded-md border border-[color:var(--border-light)] p-3">
                <label className="flex items-center gap-2 text-sm text-text-primary">
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
                <label className="flex items-center gap-2 text-sm text-text-primary">
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

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                Stack Name
                <span className="ml-2 text-[11px] text-text-muted">Optional override</span>
              </span>
              <input
                className={cn(
                  "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]",
                  hasSubmitted && formErrors.stackName ? "border-rose-300" : "border-[color:var(--border-light)]",
                )}
                placeholder={generatedStackName}
                value={form.stackName}
                onChange={(event) => setField("stackName", event.target.value)}
              />
              <p className="text-xs text-text-muted">
                {hasCustomStackName ? `Using custom stack name: ${effectiveStackName}` : `Generated stack name: ${effectiveStackName}`}
              </p>
              {hasSubmitted && formErrors.stackName ? <p className="text-xs text-rose-600">{formErrors.stackName}</p> : null}
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-[color:var(--border-light)] bg-white p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-primary">Section 2 - Enable Modules</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SetupModuleCard
              title="Billing Export"
              description="Creates billing export integration. KCX injects callback URL and callback token for stack callbacks."
              checked={form.enableBillingExport}
              onChange={(checked) => setField("enableBillingExport", checked)}
            />
            <SetupModuleCard
              title="Action Role"
              description="Creates cross-account action role for operational controls."
              checked={form.enableActionRole}
              onChange={(checked) => {
                setForm((previous) => ({
                  ...previous,
                  enableActionRole: checked,
                  enableEC2Module: checked ? previous.enableEC2Module : false,
                }))
              }}
            />
            <SetupModuleCard
              title="EC2 Module"
              description="Enables EC2 start, stop, and reboot permissions."
              checked={effectiveEnableEC2Module}
              disabled={!form.enableActionRole}
              disabledReason={!form.enableActionRole ? "Enable Action Role first." : undefined}
              onChange={(checked) => setField("enableEC2Module", checked)}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-[color:var(--border-light)] bg-white p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-primary">Section 3 - Permission Scope</p>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[color:var(--brand-primary)]"
              checked={form.useTagScopedAccess}
              onChange={(event) => setField("useTagScopedAccess", event.target.checked)}
            />
            <span className="font-medium">Use Tag Scoped Access</span>
          </label>

          {form.useTagScopedAccess ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                  Resource Tag Key
                  <span className="ml-2 text-[11px] text-brand-primary">Required</span>
                </span>
                <input
                  className={cn(
                    "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]",
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

              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                  Resource Tag Value
                  <span className="ml-2 text-[11px] text-brand-primary">Required</span>
                </span>
                <input
                  className={cn(
                    "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]",
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

        <section className="space-y-4 rounded-xl border border-[color:var(--border-light)] bg-white p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-primary">Section 4 - Advanced Optional Fields</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Export Prefix</span>
              <input
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder={DEFAULT_EXPORT_PREFIX}
                value={form.exportPrefix}
                onChange={(event) => setField("exportPrefix", event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Export Name</span>
              <input
                className="h-10 w-full rounded-md border border-[color:var(--border-light)] bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
                placeholder="KCX-CUR2-<connection-id>"
                value={form.exportName}
                onChange={(event) => setField("exportName", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-[color:var(--border-light)] bg-[color:var(--brand-soft)] p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-primary">Section 5 - Review Summary</p>
          <div className="rounded-md border border-[color:var(--border-light)] bg-white px-4 py-2">
            <ReviewRow label="Connection Name" value={normalizedConnectionName || "-"} />
            <ReviewRow label="Account Type" value={form.accountType === "payer" ? "Payer Account" : "Member Account"} />
            <ReviewRow label="Region" value={form.region} />
            <ReviewRow label="Modules" value={selectedModules.length > 0 ? selectedModules.join(", ") : "None"} />
            <ReviewRow label="Tag Scope" value={tagScopeSummary} />
            <ReviewRow label="Stack Name" value={effectiveStackName} />
          </div>
        </section>

        {submitError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button className="h-10 rounded-md" disabled={isSubmitting} onClick={onSubmitAutomaticSetup}>
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Setup Link...
              </span>
            ) : (
              "Generate AWS Setup Link"
            )}
          </Button>

          <Button variant="ghost" className="h-10 rounded-md" onClick={() => navigateTo(awsBaseRoute)}>
            Back
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
}
