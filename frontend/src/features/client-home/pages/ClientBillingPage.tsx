import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
// STEP 1:
// Client prepares billing data source (S3 bucket)
// This feeds into cross-account access setup in Step 2

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, ArrowRight, CheckCircle2, Cloud, ExternalLink, FileSpreadsheet, Loader2, Wrench } from "lucide-react"

import {
  submitAwsManualStep1,
  submitAwsManualStep2,
  submitAwsManualStep3,
  validateAwsManualConnection,
} from "@/features/client-home/api/cloud-connections.api"
import { AwsManualSetupStepTwo } from "@/features/client-home/components/AwsManualSetupStepTwo"
import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"
import { ApiError, apiGet, apiPost } from "@/lib/api"
import { getAuthUser } from "@/lib/auth"
import { handleAppLinkClick, navigateTo, useCurrentRoute } from "@/lib/navigation"
import { cn } from "@/lib/utils"

const BILLING_OPTIONS = [
  {
    label: "Upload CSV",
    href: "/client/billing/uploads",
    description: "Track CSV upload jobs and processing status.",
    icon: FileSpreadsheet,
  },
  {
    label: "Cloud Connections",
    href: "/client/billing/connect-cloud",
    description: "Manage providers and integration setup paths.",
    icon: Cloud,
  },
] as const

const ADD_CONNECTION_PROVIDERS = [
  { name: "AWS", icon: "/aws.svg", availability: "Available", description: "Connect AWS billing for cost ingestion.", href: "/client/billing/connect-cloud/aws" },
  { name: "Azure", icon: "/azure.svg", availability: "Beta", description: "Azure billing integration is currently in beta.", href: "/client/billing/connect-cloud/azure" },
  { name: "GCP", icon: "/gcp.svg", availability: "Planned", description: "GCP billing integration will be available soon.", href: "/client/billing/connect-cloud/gcp" },
  { name: "Oracle Cloud", icon: "/oracle.svg", availability: "Planned", description: "Oracle billing integration will be available soon.", href: "/client/billing/connect-cloud/oracle-cloud" },
] as const

function isCloudConnectionsRoute(path: string) {
  return path.startsWith("/client/billing/connect-cloud") || path.startsWith("/client/billing/connections")
}

const AWS_SETUP_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/aws\/setup\/([0-9a-fA-F-]{36})$/
const CLOUD_PROVIDER_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/(aws|azure|gcp|oracle-cloud)(?:\/|$)/
const CLOUD_SETUP_METHOD_ROUTE_REGEX = /^\/client\/billing\/(?:connect-cloud|connections)\/(?:aws|azure|gcp|oracle-cloud)\/(automatic|manual)(?:\/|$)/

const CLOUD_PROVIDER_LABELS: Record<string, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
  "oracle-cloud": "Oracle Cloud",
}

type CloudConnection = {
  id: string
  connection_name: string
  provider: string
  status: string
  account_type: string
}

function AddConnectionProviderCard({
  name,
  icon,
  availability,
  description,
  href,
}: {
  name: string
  icon: string
  availability: string
  description: string
  href?: string
}) {
  const isEnabled = Boolean(href)
  const className = cn(
    "h-full rounded-md border bg-white p-4 transition-colors",
    isEnabled
      ? "border-[color:var(--kcx-border-soft)] hover:bg-[color:var(--bg-surface)] hover:border-[color:var(--kcx-border-strong)]"
      : "border-[color:var(--border-light)]"
  )

  const content = (
    <div className={className}>
      <div className="flex items-center justify-between">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
          <img src={icon} alt={name} className="h-7 w-7 object-contain" />
        </span>
        <Badge
          variant="outline"
          className={cn(
            "rounded-md",
            isEnabled
              ? "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary"
              : "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-muted"
          )}
        >
          {availability}
        </Badge>
      </div>
      <h3 className="mt-3 text-base font-semibold text-text-primary">{name}</h3>
      <p className="mt-1 text-sm leading-5 text-text-secondary">{description}</p>
    </div>
  )

  if (!isEnabled || !href) return content

  return (
    <a href={href} onClick={(event) => handleAppLinkClick(event, href)} className="block h-full">
      {content}
    </a>
  )
}

function AwsLoginSection() {
  const billingConsoleUrl = "https://console.aws.amazon.com/costmanagement/home#/bcm-data-exports"

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-text-primary">1.1 Access AWS Billing Console</h4>
        <p className="text-sm text-text-secondary">
          Open AWS Billing and navigate to Data Exports to create a new export.
        </p>
      </div>
      <div className="rounded-md border border-[color:var(--border-light)] bg-white p-4">
        <a href={billingConsoleUrl} target="_blank" rel="noreferrer">
          <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]">
            Open AWS Billing Console
            <ExternalLink className="ml-1.5 h-4 w-4" />
          </Button>
        </a>
      </div>
    </section>
  )
}

function ConfigureExportSection() {
  const requiredConfiguration = [
    { label: "Export type", value: "Standard data export" },
    { label: "Data table", value: "FOCUS with AWS columns" },
    { label: "Schema version", value: "FOCUS 1.2" },
    { label: "Time granularity", value: "Hourly" },
    { label: "File format", value: "gzip (CSV)" },
  ]

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-text-primary">1.2 Configure Billing Data Export</h4>
        <p className="text-sm text-text-secondary">
          While creating the export in AWS, use the following required configuration.
        </p>
      </div>

      <div className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-white p-5">
        <div className="space-y-3">
          <h5 className="text-sm font-semibold text-text-primary">Required Configuration</h5>
          <div className="rounded-md border border-[color:var(--border-light)]">
            {requiredConfiguration.map((row, index) => (
              <div
                key={row.label}
                className={cn(
                  "grid grid-cols-1 gap-1 px-4 py-3 text-sm md:grid-cols-[220px_minmax(0,1fr)] md:items-center",
                  index < requiredConfiguration.length - 1 ? "border-b border-[color:var(--border-light)]" : ""
                )}
              >
                <p className="text-text-secondary">{row.label}</p>
                <p className="font-medium text-text-primary md:text-right">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[color:var(--border-light)] pt-4">
          <div className="space-y-3">
            <h5 className="text-sm font-semibold text-text-primary">File versioning</h5>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">First-time setup</p>
                <p className="mt-1 text-sm font-medium text-text-primary">Create new export</p>
              </div>
              <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Existing export</p>
                <p className="mt-1 text-sm font-medium text-text-primary">Overwrite existing</p>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              Choose overwrite only if you are reconfiguring an existing export.
            </p>
          </div>
        </div>

        <div className="border-t border-[color:var(--border-light)] pt-4">
          <div className="space-y-2">
            <h5 className="text-sm font-semibold text-text-primary">Storage Configuration</h5>
            <p className="text-sm text-text-secondary">
              S3 bucket: User will provide below
            </p>
            <p className="text-sm text-text-secondary">
              S3 prefix: Optional folder inside bucket
            </p>
          </div>
        </div>

        <div className="border-t border-[color:var(--border-light)] pt-4">
          <div className="space-y-1">
            <p className="text-xs text-text-muted">Do not use Parquet format.</p>
            <p className="text-xs text-text-muted">Ensure FOCUS 1.2 is selected.</p>
            <p className="text-xs text-text-muted">Hourly granularity is required.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function S3InputSection({
  bucketName,
  pathPrefix,
  onBucketNameChange,
  onPathPrefixChange,
  showBucketFormatHint,
}: {
  bucketName: string
  pathPrefix: string
  onBucketNameChange: (value: string) => void
  onPathPrefixChange: (value: string) => void
  showBucketFormatHint: boolean
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-text-primary">1.3 Enter your storage details</h4>
        <p className="text-sm text-text-secondary">
          Enter the S3 bucket name only. Do not include the full S3 path.
        </p>
      </div>
      <div className="rounded-md border border-gray-200 bg-white p-5">
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">S3 Bucket Name</span>
        <input
          className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
          placeholder="e.g. company-billing-export"
          value={bucketName}
          onChange={(event) => onBucketNameChange(event.target.value)}
        />
      </label>
      <p className="text-xs text-text-muted">e.g. company-billing-export</p>
      {showBucketFormatHint ? (
        <p className="text-xs text-text-muted">Bucket names should not contain spaces.</p>
      ) : null}
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">S3 Path Prefix (optional)</span>
        <input
          className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
          placeholder="Optional folder prefix"
          value={pathPrefix}
          onChange={(event) => onPathPrefixChange(event.target.value)}
        />
      </label>
      <p className="text-xs text-text-muted">
        Optional: specify a folder (prefix) within the bucket.
      </p>
      </div>
    </section>
  )
}

type ManualSetupStepThreeProps = {
  connectionName: string
  dataExportName: string
  roleArn: string
  onConnectionNameChange: (value: string) => void
  onDataExportNameChange: (value: string) => void
  onRoleArnChange: (value: string) => void
  roleNameHint: string
}

function ManualSetupStepThree({
  connectionName,
  dataExportName,
  roleArn,
  onConnectionNameChange,
  onDataExportNameChange,
  onRoleArnChange,
  roleNameHint,
}: ManualSetupStepThreeProps) {
  return (
    <Card className="rounded-md border-gray-200 bg-[color:var(--bg-surface)] shadow-none">
      <CardContent className="space-y-6 p-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">STEP 3</p>
          <h3 className="text-lg font-semibold text-text-primary">Confirm Connection Details</h3>
          <p className="text-sm text-text-secondary">
            Final confirmation: review and enter the exact AWS values to complete this connection.
          </p>
        </div>

        <div className="border-t border-[color:var(--border-light)]" />

        <section className="space-y-4 rounded-md border border-[color:var(--border-light)] bg-white p-5">
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-text-primary">3.1 Final Confirmation Inputs</h4>
            <p className="text-sm text-text-secondary">
              Enter the exact AWS resource values created in Steps 1 and 2.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Connection Name</span>
            <input
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
              placeholder="ex: kcx-cz-30-march"
              value={connectionName}
              onChange={(event) => onConnectionNameChange(event.target.value)}
            />
            <p className="text-xs text-text-muted">
              This name helps you identify this AWS connection inside KCX.
            </p>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Data Export Name</span>
            <input
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
              placeholder="ex: billing-export-march"
              value={dataExportName}
              onChange={(event) => onDataExportNameChange(event.target.value)}
            />
            <p className="text-xs text-text-muted">
              Use the exact export name created in AWS Billing Data Exports during Step 1.
            </p>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
              Cross-Account IAM Role ARN
            </span>
            <input
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
              placeholder="arn:aws:iam::123456789012:role/example-role-name"
              value={roleArn}
              onChange={(event) => onRoleArnChange(event.target.value)}
            />
            {roleNameHint ? (
              <p className="text-xs text-text-muted">
                Step 2 role name entered: <span className="font-medium text-text-primary">{roleNameHint}</span>
              </p>
            ) : null}
            <p className="text-xs text-text-muted">
              Enter the full ARN of the IAM role created in Step 2.
            </p>
          </label>
        </section>
      </CardContent>
    </Card>
  )
}

function ManualSetupProgress({
  isStep1Complete,
  isStep2Complete,
  isStep3Complete,
}: {
  isStep1Complete: boolean
  isStep2Complete: boolean
  isStep3Complete: boolean
}) {
  const step2Active = isStep1Complete && !isStep2Complete
  const step3Locked = !isStep2Complete
  const step3Active = isStep2Complete && !isStep3Complete

  return (
    <div className="sticky top-4 z-20 rounded-md border border-[color:var(--border-light)] bg-white/95 p-3 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em]">
        <span className={cn("rounded-md border px-2.5 py-1", isStep1Complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary")}>
          Step 1 {isStep1Complete ? "✓" : "→"}
        </span>
        <span className="text-text-muted">—</span>
        <span className={cn("rounded-md border px-2.5 py-1", step2Active ? "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary" : isStep2Complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-muted")}>
          Step 2 {isStep2Complete ? "✓" : "→"}
        </span>
        <span className="text-text-muted">—</span>
        <span className={cn("rounded-md border px-2.5 py-1", step3Locked ? "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-muted" : step3Active ? "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
          Step 3 {isStep3Complete ? "✓" : step3Locked ? "Locked" : "→"}
        </span>
      </div>
    </div>
  )
}

function ReviewValueRow({ label, value }: { label: string; value: string | null }) {
  const safeValue = value && value.trim().length > 0 ? value : "Not provided"

  return (
    <div className="grid grid-cols-1 gap-1 border-b border-[color:var(--border-light)] px-4 py-3 text-sm last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)]">
      <p className="text-text-secondary">{label}</p>
      <p className="break-words font-medium text-text-primary md:text-right">{safeValue}</p>
    </div>
  )
}

function mapValidationErrorMessage(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes("access denied")) return "Validation failed: access denied for the provided AWS role or bucket."
  if (normalized.includes("assume") || normalized.includes("sts")) return "Validation failed: unable to assume the AWS IAM role."
  if (normalized.includes("external")) return "Validation failed: external ID does not match the IAM trust configuration."
  if (normalized.includes("bucket") || normalized.includes("s3")) return "Validation failed: unable to access the configured S3 bucket or prefix."
  if (normalized.includes("arn")) return "Validation failed: the IAM role ARN appears to be invalid."
  return message || "Validation failed. Review the configuration and try again."
}

function AwsSetupReviewValidation({
  bucketName,
  pathPrefix,
  externalId,
  roleName,
  customPolicyName,
  connectionName,
  dataExportName,
  roleArn,
  onBackToEdit,
  onValidate,
  validateStatus,
  validationMessage,
}: {
  bucketName: string
  pathPrefix: string
  externalId: string
  roleName: string
  customPolicyName: string
  connectionName: string
  dataExportName: string
  roleArn: string
  onBackToEdit: () => void
  onValidate: () => void
  validateStatus: "idle" | "validating" | "success" | "failure"
  validationMessage: string | null
}) {
  return (
    <div className="space-y-5">
      <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-none">
        <CardContent className="space-y-2 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Review & Validate</p>
          <h3 className="text-lg font-semibold text-text-primary">Review AWS Connection Configuration</h3>
          <p className="text-sm text-text-secondary">
            Confirm the setup values below, then run a live connection validation.
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-none">
        <CardContent className="p-0">
          <div className="px-4 py-3">
            <h4 className="text-sm font-semibold text-text-primary">Billing Data Export</h4>
          </div>
          <div className="border-t border-[color:var(--border-light)]">
            <ReviewValueRow label="S3 Bucket Name" value={bucketName} />
            <ReviewValueRow label="S3 Prefix" value={pathPrefix} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-none">
        <CardContent className="p-0">
          <div className="px-4 py-3">
            <h4 className="text-sm font-semibold text-text-primary">IAM Configuration</h4>
          </div>
          <div className="border-t border-[color:var(--border-light)]">
            <ReviewValueRow label="External ID" value={externalId} />
            <ReviewValueRow label="IAM Role Name" value={roleName} />
            <ReviewValueRow label="Custom Policy Name" value={customPolicyName} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-none">
        <CardContent className="p-0">
          <div className="px-4 py-3">
            <h4 className="text-sm font-semibold text-text-primary">Final Connection Details</h4>
          </div>
          <div className="border-t border-[color:var(--border-light)]">
            <ReviewValueRow label="Connection Name" value={connectionName} />
            <ReviewValueRow label="Data Export Name" value={dataExportName} />
            <ReviewValueRow label="Role ARN" value={roleArn} />
          </div>
        </CardContent>
      </Card>

      {validateStatus === "validating" ? (
        <div className="rounded-md border border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] p-4 text-sm text-text-primary">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Validating connection...</span>
          </div>
        </div>
      ) : null}

      {validateStatus === "success" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <p>{validationMessage ?? "Validation successful. Connection is active."}</p>
          </div>
        </div>
      ) : null}

      {validateStatus === "failure" ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <p>{validationMessage ?? "Validation failed. Review your configuration and retry."}</p>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-md border-[color:var(--border-light)]"
          onClick={onBackToEdit}
          disabled={validateStatus === "validating"}
        >
          Back to Edit
        </Button>
        <Button type="button" className="h-10 rounded-md" onClick={onValidate} disabled={validateStatus === "validating"}>
          {validateStatus === "validating" ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Validating connection...
            </>
          ) : (
            "Validate Connection"
          )}
        </Button>
      </div>
    </div>
  )
}

function AwsManualSetupSinglePageFlow() {
  const authUser = getAuthUser()

  const [viewMode, setViewMode] = useState<"setup" | "review">("setup")
  const [connectionId, setConnectionId] = useState("")
  const [bucketName, setBucketName] = useState("")
  const [pathPrefix, setPathPrefix] = useState("")
  const [externalId, setExternalId] = useState("")
  const [roleName, setRoleName] = useState("")
  const [customPolicyName, setCustomPolicyName] = useState("")
  const [connectionName, setConnectionName] = useState("")
  const [dataExportName, setDataExportName] = useState("")
  const [roleArn, setRoleArn] = useState("")
  const [finishError, setFinishError] = useState<string | null>(null)
  const [isSubmittingFinish, setIsSubmittingFinish] = useState(false)
  const [validateStatus, setValidateStatus] = useState<"idle" | "validating" | "success" | "failure">("idle")
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [step1SaveStatus, setStep1SaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [step1SubmitError, setStep1SubmitError] = useState<string | null>(null)
  const lastSavedStep1SignatureRef = useRef("")

  const flowStorageKey = useMemo(
    () => `kcx_aws_manual_flow_user_${authUser?.id ?? "anonymous"}`,
    [authUser?.id],
  )

  useEffect(() => {
    const existing = localStorage.getItem(flowStorageKey)
    if (!existing) return

    try {
      const parsed = JSON.parse(existing) as {
        connectionId?: string
        bucketName?: string
        pathPrefix?: string
        externalId?: string
        roleName?: string
        customPolicyName?: string
        connectionName?: string
        dataExportName?: string
        roleArn?: string
      }
      setConnectionId(typeof parsed.connectionId === "string" ? parsed.connectionId : "")
      setBucketName(typeof parsed.bucketName === "string" ? parsed.bucketName : "")
      setPathPrefix(typeof parsed.pathPrefix === "string" ? parsed.pathPrefix : "")
      setExternalId(typeof parsed.externalId === "string" ? parsed.externalId : "")
      setRoleName(typeof parsed.roleName === "string" ? parsed.roleName : "")
      setCustomPolicyName(typeof parsed.customPolicyName === "string" ? parsed.customPolicyName : "")
      setConnectionName(typeof parsed.connectionName === "string" ? parsed.connectionName : "")
      setDataExportName(typeof parsed.dataExportName === "string" ? parsed.dataExportName : "")
      setRoleArn(typeof parsed.roleArn === "string" ? parsed.roleArn : "")
    } catch {
      // Ignore malformed local storage payload.
    }
  }, [flowStorageKey])

  useEffect(() => {
    const payload = {
      connectionId: connectionId.trim(),
      bucketName: bucketName.trim(),
      pathPrefix: pathPrefix.trim(),
      externalId: externalId.trim(),
      roleName: roleName.trim(),
      customPolicyName: customPolicyName.trim(),
      connectionName: connectionName.trim(),
      dataExportName: dataExportName.trim(),
      roleArn: roleArn.trim(),
    }
    localStorage.setItem(flowStorageKey, JSON.stringify(payload))
  }, [bucketName, connectionId, connectionName, customPolicyName, dataExportName, externalId, flowStorageKey, pathPrefix, roleArn, roleName])

  const hasBucketName = bucketName.trim().length > 0
  const hasNoSpacesInBucketName = !/\s/.test(bucketName)
  const showBucketFormatHint = hasBucketName && !hasNoSpacesInBucketName

  const isStep1Complete = hasBucketName && hasNoSpacesInBucketName
  const isStep2Complete = roleName.trim().length > 0 && customPolicyName.trim().length > 0
  const isStep3Complete = connectionName.trim().length > 0 && dataExportName.trim().length > 0 && roleArn.trim().length > 0
  const isAllComplete = isStep1Complete && isStep2Complete && isStep3Complete

  useEffect(() => {
    if (!isStep1Complete) {
      setStep1SaveStatus("idle")
      return
    }

    const trimmedBucketName = bucketName.trim()
    const trimmedPrefix = pathPrefix.trim().replace(/\/+$/g, "")
    const payload = {
      bucketName: trimmedBucketName,
      ...(trimmedPrefix.length > 0 ? { bucketPrefix: trimmedPrefix } : {}),
    }
    const nextSignature = JSON.stringify(payload)
    if (lastSavedStep1SignatureRef.current === nextSignature) {
      return
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        setStep1SubmitError(null)
        setStep1SaveStatus("saving")
        try {
          const response = await submitAwsManualStep1(payload)
          setConnectionId(response.connectionId)
          lastSavedStep1SignatureRef.current = nextSignature
          setStep1SaveStatus("saved")
        } catch (error) {
          if (error instanceof ApiError) {
            setStep1SubmitError(error.message || "Could not save Step 1. Please try again.")
          } else {
            setStep1SubmitError("Could not save Step 1. Please try again.")
          }
          setStep1SaveStatus("error")
        }
      })()
    }, 400)

    return () => window.clearTimeout(timeout)
  }, [bucketName, isStep1Complete, pathPrefix])

  async function ensureStep1Persisted(): Promise<string> {
    const trimmedBucketName = bucketName.trim()
    const trimmedPrefix = pathPrefix.trim().replace(/\/+$/g, "")

    const payload = {
      bucketName: trimmedBucketName,
      ...(trimmedPrefix.length > 0 ? { bucketPrefix: trimmedPrefix } : {}),
    }

    if (connectionId.trim().length > 0 && lastSavedStep1SignatureRef.current === JSON.stringify(payload)) {
      return connectionId
    }

    const response = await submitAwsManualStep1(payload)
    setConnectionId(response.connectionId)
    lastSavedStep1SignatureRef.current = JSON.stringify(payload)
    return response.connectionId
  }

  async function handleFinishSetup() {
    if (!isAllComplete || isSubmittingFinish) return

    setFinishError(null)
    setIsSubmittingFinish(true)

    try {
      const persistedConnectionId = await ensureStep1Persisted()
      const normalizedExternalId = externalId.trim()
      const externalIdStorageKey = `kcx_aws_external_id_user_${authUser?.id ?? "anonymous"}`
      const fallbackExternalId = localStorage.getItem(externalIdStorageKey)?.trim() ?? ""
      const externalIdForSubmit = normalizedExternalId || fallbackExternalId

      if (!externalIdForSubmit) {
        throw new Error("External ID is missing. Return to Step 2 and regenerate it.")
      }

      if (!normalizedExternalId && fallbackExternalId) {
        setExternalId(fallbackExternalId)
      }

      await submitAwsManualStep2({
        connectionId: persistedConnectionId,
        externalId: externalIdForSubmit,
        roleName: roleName.trim(),
        policyName: customPolicyName.trim(),
      })

      await submitAwsManualStep3({
        connectionId: persistedConnectionId,
        connectionName: connectionName.trim(),
        reportName: dataExportName.trim(),
        roleArn: roleArn.trim(),
      })

      setValidateStatus("idle")
      setValidationMessage(null)
      setViewMode("review")
    } catch (error) {
      if (error instanceof ApiError) {
        setFinishError(error.message || "Could not prepare connection for validation.")
      } else if (error instanceof Error) {
        setFinishError(error.message)
      } else {
        setFinishError("Could not prepare connection for validation.")
      }
    } finally {
      setIsSubmittingFinish(false)
    }
  }

  async function handleValidateConnection() {
    const normalizedConnectionId = connectionId.trim()
    if (!normalizedConnectionId || validateStatus === "validating") return

    setValidateStatus("validating")
    setValidationMessage(null)

    try {
      const result = await validateAwsManualConnection({ connectionId: normalizedConnectionId })
      const resultStatus = (result.status ?? "").toUpperCase()

      if (resultStatus === "ACTIVE") {
        setValidateStatus("success")
        setValidationMessage("Connection verified successfully. AWS integration is active.")
      } else {
        setValidateStatus("failure")
        setValidationMessage(
          mapValidationErrorMessage(result.error ?? result.message ?? "Validation failed. Review configuration and retry.")
        )
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setValidateStatus("failure")
        setValidationMessage(mapValidationErrorMessage(error.message || "Validation failed."))
      } else {
        setValidateStatus("failure")
        setValidationMessage("Validation failed. Review configuration and retry.")
      }
    }
  }

  if (viewMode === "review") {
    return (
      <AwsSetupReviewValidation
        bucketName={bucketName.trim()}
        pathPrefix={pathPrefix.trim()}
        externalId={externalId.trim()}
        roleName={roleName.trim()}
        customPolicyName={customPolicyName.trim()}
        connectionName={connectionName.trim()}
        dataExportName={dataExportName.trim()}
        roleArn={roleArn.trim()}
        onBackToEdit={() => setViewMode("setup")}
        onValidate={() => {
          void handleValidateConnection()
        }}
        validateStatus={validateStatus}
        validationMessage={validationMessage}
      />
    )
  }

  return (
    <div className="space-y-5">
      <ManualSetupProgress
        isStep1Complete={isStep1Complete}
        isStep2Complete={isStep2Complete}
        isStep3Complete={isStep3Complete}
      />

      <Card className="rounded-md border-gray-200 bg-[color:var(--bg-surface)] shadow-none">
        <CardContent className="space-y-7 p-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Step 1</p>
            <h3 className="text-lg font-semibold text-text-primary">Prepare your billing data</h3>
            <p className="text-sm text-text-secondary">
              Configure your AWS Billing Data Export using the exact settings required by KCX.
            </p>
          </div>
          <div className="border-t border-[color:var(--border-light)]" />
          <AwsLoginSection />
          <div className="border-t border-[color:var(--border-light)]" />
          <ConfigureExportSection />
          <div className="border-t border-[color:var(--border-light)]" />
          <S3InputSection
            bucketName={bucketName}
            pathPrefix={pathPrefix}
            onBucketNameChange={setBucketName}
            onPathPrefixChange={setPathPrefix}
            showBucketFormatHint={showBucketFormatHint}
          />
          {step1SubmitError ? (
            <p className="text-sm text-red-700">{step1SubmitError}</p>
          ) : isStep1Complete ? (
            <p className="text-sm text-text-secondary">
              {step1SaveStatus === "saving" ? "Saving Step 1..." : "Step 1 complete."}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className={cn("transition-opacity", !isStep1Complete ? "pointer-events-none opacity-60" : "")}>
        <AwsManualSetupStepTwo
          roleName={roleName}
          customPolicyName={customPolicyName}
          onRoleNameChange={setRoleName}
          onCustomPolicyNameChange={setCustomPolicyName}
          bucketNameHint={bucketName}
          onExternalIdChange={setExternalId}
        />
      </div>

      <div className={cn("transition-opacity", !isStep2Complete ? "pointer-events-none opacity-60" : "")}>
        <ManualSetupStepThree
          connectionName={connectionName}
          dataExportName={dataExportName}
          roleArn={roleArn}
          onConnectionNameChange={setConnectionName}
          onDataExportNameChange={setDataExportName}
          onRoleArnChange={setRoleArn}
          roleNameHint={roleName.trim()}
        />
      </div>

      <div className="flex justify-end">
        <Button
          className="h-10 rounded-md"
          disabled={!isAllComplete || isSubmittingFinish}
          onClick={() => {
            void handleFinishSetup()
          }}
        >
          {isSubmittingFinish ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Preparing review...
            </>
          ) : (
            "Finish Setup"
          )}
        </Button>
      </div>
      {finishError ? <p className="text-sm text-rose-700">{finishError}</p> : null}
    </div>
  )
}

export function ClientBillingPage() {
  const route = useCurrentRoute()
  const activeRoute = route
  const isBillingHubRoute = activeRoute === "/client/billing"
  const cloudProviderSlug = useMemo(() => {
    const match = CLOUD_PROVIDER_ROUTE_REGEX.exec(activeRoute)
    if (!match) return null
    return match[1]
  }, [activeRoute])
  const cloudProviderName = cloudProviderSlug ? CLOUD_PROVIDER_LABELS[cloudProviderSlug] : null
  const cloudSetupMethod = useMemo(() => {
    const match = CLOUD_SETUP_METHOD_ROUTE_REGEX.exec(activeRoute)
    if (!match) return null
    return match[1] === "automatic" ? "Automatic" : "Manual"
  }, [activeRoute])
  const cloudProviderRoute = cloudProviderSlug ? `/client/billing/connect-cloud/${cloudProviderSlug}` : null

  const pageHeaderTitle: ReactNode = useMemo(() => {
    if (!isCloudConnectionsRoute(activeRoute)) return "Billing"

    const linkClass = "text-brand-primary hover:underline"
    const dividerClass = "mx-2 text-text-muted"

    return (
      <>
        <span>Billing</span>
        <span className={dividerClass}>/</span>
        {cloudProviderName ? (
          <a
            href="/client/billing/connect-cloud"
            onClick={(event) => handleAppLinkClick(event, "/client/billing/connect-cloud")}
            className={linkClass}
          >
            Cloud Connection
          </a>
        ) : (
          <span>Cloud Connection</span>
        )}
        {cloudProviderName ? (
          <>
            <span className={dividerClass}>/</span>
            {cloudSetupMethod && cloudProviderRoute ? (
              <a href={cloudProviderRoute} onClick={(event) => handleAppLinkClick(event, cloudProviderRoute)} className={linkClass}>
                {cloudProviderName}
              </a>
            ) : (
              <span>{cloudProviderName}</span>
            )}
          </>
        ) : null}
        {cloudSetupMethod ? (
          <>
            <span className={dividerClass}>/</span>
            <span>{cloudSetupMethod}</span>
          </>
        ) : null}
      </>
    )
  }, [activeRoute, cloudProviderName, cloudProviderRoute, cloudSetupMethod])
  const pageHeaderDescription = isCloudConnectionsRoute(activeRoute)
    ? "Manage connected cloud accounts and integration setup."
    : "Choose how you want to start billing ingestion."

  const [autoConnectionName, setAutoConnectionName] = useState("")
  const [autoAccountType, setAutoAccountType] = useState<"payer" | "member">("payer")
  const [autoTouched, setAutoTouched] = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  const [autoError, setAutoError] = useState<string | null>(null)

  const setupConnectionId = useMemo(() => {
    const match = AWS_SETUP_ROUTE_REGEX.exec(activeRoute)
    if (!match) return null
    return match[1]
  }, [activeRoute])

  const [setupConnection, setSetupConnection] = useState<CloudConnection | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    if (!setupConnectionId) return
    setSetupLoading(true)
    setSetupError(null)
    void (async () => {
      try {
        const connection = await apiGet<CloudConnection>(`/cloud-connections/${setupConnectionId}`)
        setSetupConnection(connection)
      } catch (error) {
        if (error instanceof ApiError) {
          setSetupError(error.message || "Failed to load connection")
        } else {
          setSetupError("Failed to load connection")
        }
        setSetupConnection(null)
      } finally {
        setSetupLoading(false)
      }
    })()
  }, [setupConnectionId])

  function validateAutoConnectionName(value: string) {
    return value.trim().length > 0
  }

  function onSubmitAutomaticSetup() {
    setAutoTouched(true)
    setAutoError(null)
    if (!validateAutoConnectionName(autoConnectionName)) return

    // Open a tab immediately from the user click to avoid popup blockers.
    // Do not use noopener here because some browsers return null window handles,
    // which prevents us from assigning the backend URL after async calls complete.
    const setupTab = window.open("about:blank", "_blank")
    setAutoSubmitting(true)
    void (async () => {
      try {
        const created = await apiPost<CloudConnection>("/cloud-connections", {
          connection_name: autoConnectionName.trim(),
          provider: "aws",
          status: "draft",
          account_type: autoAccountType,
        })

        const setup = await apiGet<{ url: string }>(`/cloud-connections/${created.id}/aws-cloudformation-url`)
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
          setAutoError(error.message || "Failed to create connection")
        } else {
          setAutoError("Failed to create connection")
        }
      } finally {
        setAutoSubmitting(false)
      }
    })()
  }

  if (isBillingHubRoute) {
    return (
      <>
        <ClientPageHeader eyebrow="Billing Workspace" title={pageHeaderTitle} description={pageHeaderDescription} />

        <section aria-label="Billing quick start" className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {BILLING_OPTIONS.map((option) => {
            const OptionIcon = option.icon
            const isCloud = option.href === "/client/billing/connect-cloud"

            return (
              <Card
                key={option.href}
                className={cn(
                  "group relative overflow-hidden rounded-md border shadow-sm-custom transition-all",
                  isCloud
                    ? "border-[color:var(--kcx-border-soft)] bg-[linear-gradient(160deg,#f6fffb_0%,#f2faf7_46%,#ffffff_100%)]"
                    : "border-[color:var(--border-light)] bg-[linear-gradient(160deg,#ffffff_0%,#f7faf9_100%)]"
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-2xl",
                    isCloud ? "bg-[rgba(63,154,125,0.16)]" : "bg-[rgba(35,110,88,0.1)]"
                  )}
                />
                <CardContent className="relative space-y-5 p-6">
                  <div className="space-y-3">
                    <span
                      className={cn(
                        "inline-flex h-11 w-11 items-center justify-center rounded-md border",
                        isCloud
                          ? "border-[color:var(--kcx-border-soft)] bg-white text-brand-primary"
                          : "border-[color:var(--border-light)] bg-white text-text-secondary"
                      )}
                    >
                      <OptionIcon className="h-5 w-5" />
                    </span>
                    <div className="space-y-1.5">
                      <p className="kcx-eyebrow text-brand-primary">{isCloud ? "Cloud Setup" : "Manual Upload"}</p>
                      <h2 className="text-2xl font-semibold tracking-tight text-text-primary">{option.label}</h2>
                      <p className="max-w-[45ch] text-sm leading-6 text-text-secondary">{option.description}</p>
                    </div>
                  </div>

                  <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-white/80 p-3.5 text-xs leading-6 text-text-muted">
                    {isCloud
                      ? "Best for automated, continuous billing ingestion from connected cloud accounts."
                      : "Best for getting started quickly with exported billing files and manual uploads."}
                  </div>

                  <Button
                    className={cn(
                      "h-11 rounded-md px-5",
                      isCloud
                        ? "bg-[color:var(--brand-primary)] text-white hover:brightness-95"
                        : ""
                    )}
                    variant={isCloud ? "default" : "outline"}
                    onClick={() => navigateTo(option.href)}
                  >
                    {isCloud ? "Open Cloud Connection" : "Open Upload CSV"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </section>
      </>
    )
  }

  return (
    <>
      <ClientPageHeader
        eyebrow="Billing Workspace"
        title={pageHeaderTitle}
        description={pageHeaderDescription}
      />

      <section aria-label="Billing workspace options">
        <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <CardContent className="space-y-6 p-6">
            {activeRoute === "/client/billing/uploads" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">Upload CSV</p>
                  <h2 className="text-lg font-semibold text-text-primary">Upload History</h2>
                  <p className="text-sm text-text-secondary">
                    CSV upload history and parsing diagnostics will appear here in the next billing sprint.
                  </p>
                </div>
                <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4 text-sm text-text-muted">
                  No upload records available yet.
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connect-cloud" ||
            activeRoute === "/client/billing/connect-cloud/add" ||
            activeRoute === "/client/billing/connections" ||
            activeRoute === "/client/billing/connections/add" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">Connect Cloud</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Choose Cloud Provider</h2>
                  <p className="text-sm text-text-secondary">
                    Select a cloud provider to begin a new billing integration setup.
                  </p>
                </div>
                <div className="grid grid-cols-1 auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {ADD_CONNECTION_PROVIDERS.map((provider) => (
                    <AddConnectionProviderCard key={provider.name} {...provider} />
                  ))}
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connect-cloud/aws" || activeRoute === "/client/billing/connections/aws" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">AWS Setup Choice</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Choose Setup Method</h2>
                  <p className="text-sm text-text-secondary">
                    Select how you want to connect AWS billing data into KCX.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card className="rounded-md border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
                    <CardContent className="space-y-3 p-5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-white text-text-secondary">
                        <Cloud className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-semibold text-text-primary">Automatic Setup </h3>
                      <p className="text-sm text-text-secondary">Guided cloud-native onboarding with secure automated provisioning.</p>
                      <Button
                        variant="outline"
                        className="h-10 rounded-md border-[color:var(--border-light)]"
                        onClick={() => navigateTo("/client/billing/connect-cloud/aws/automatic")}
                      >
                        Start Automatic Setup
                      </Button>
                    </CardContent>
                  </Card>
                  <Card className="rounded-md border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)]">
                    <CardContent className="space-y-3 p-5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--kcx-border-soft)] bg-white text-brand-primary">
                        <Wrench className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-semibold text-text-primary">Manual Setup</h3>
                      <p className="text-sm text-text-secondary">Use account details and IAM role configuration to connect billing manually.</p>
                      <Button className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connect-cloud/aws/manual")}>
                        Start Manual Setup
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}

            {cloudProviderSlug && cloudProviderSlug !== "aws" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">{cloudProviderName} Integration</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">{cloudProviderName} Setup</h2>
                  <p className="text-sm text-text-secondary">
                    Billing integration setup for {cloudProviderName} is coming soon.
                  </p>
                </div>
                <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4 text-sm text-text-muted">
                  This provider route is ready. Detailed onboarding steps for {cloudProviderName} will be added soon.
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connect-cloud/aws/automatic" || activeRoute === "/client/billing/connections/aws/automatic" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">AWS Automatic Setup</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Start Automatic Setup</h2>
                  <p className="text-sm text-text-secondary">Create an AWS connection to begin guided setup.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-1.5 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Connection Name
                      <span className="ml-2 align-middle text-[11px] font-semibold text-brand-primary">Required</span>
                    </span>
                    <input
                      className={cn(
                        "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]",
                        autoTouched && !validateAutoConnectionName(autoConnectionName)
                          ? "border-rose-300"
                          : "border-[color:var(--border-light)]"
                      )}
                      placeholder="prod-aws-account"
                      value={autoConnectionName}
                      onChange={(event) => setAutoConnectionName(event.target.value)}
                      onBlur={() => setAutoTouched(true)}
                      required
                    />
                    {autoTouched && !validateAutoConnectionName(autoConnectionName) ? (
                      <p className="text-xs text-rose-600">Connection Name is required.</p>
                    ) : null}
                    {autoError ? <p className="text-xs text-rose-600">{autoError}</p> : null}
                  </label>

                  <fieldset className="space-y-2 md:col-span-2">
                    <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Account Type
                      <span className="ml-2 align-middle text-[11px] font-semibold text-brand-primary">Required</span>
                    </legend>
                    <div className="space-y-2 rounded-md border border-[color:var(--border-light)] bg-white p-3">
                      <label className="flex items-center gap-2 text-sm text-text-primary">
                        <input
                          type="radio"
                          name="aws-account-type"
                          value="payer"
                          checked={autoAccountType === "payer"}
                          onChange={() => setAutoAccountType("payer")}
                          className="h-4 w-4 accent-[color:var(--brand-primary)]"
                        />
                        <span className="font-medium">Payer Account</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-text-primary">
                        <input
                          type="radio"
                          name="aws-account-type"
                          value="member"
                          checked={autoAccountType === "member"}
                          onChange={() => setAutoAccountType("member")}
                          className="h-4 w-4 accent-[color:var(--brand-primary)]"
                        />
                        <span className="font-medium">Member Account</span>
                      </label>
                    </div>
                  </fieldset>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button className="h-10 rounded-md" disabled={autoSubmitting} onClick={onSubmitAutomaticSetup}>
                    {autoSubmitting ? "Saving..." : "Continue Setup"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-10 rounded-md"
                    onClick={() => navigateTo("/client/billing/connect-cloud/aws")}
                  >
                    Back
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : null}

            {setupConnectionId ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">Setup AWS Connection</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Setup AWS Connection</h2>
                  <p className="text-sm text-text-secondary">Review connection details and launch guided setup.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <Card className="rounded-md border-[color:var(--border-light)] bg-white">
                    <CardContent className="space-y-4 p-5">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-primary">Connection Info</p>
                        <p className="text-sm text-text-secondary">Connection Name, provider, and status.</p>
                      </div>

                      {setupLoading ? (
                        <p className="text-sm text-text-secondary">Loading connection...</p>
                      ) : setupError ? (
                        <p className="text-sm text-rose-600">{setupError}</p>
                      ) : setupConnection ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Connection Name</p>
                            <p className="text-sm font-medium text-text-primary">{setupConnection.connection_name}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Provider</p>
                            <p className="text-sm font-medium text-text-primary">{setupConnection.provider.toUpperCase()}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Status</p>
                            <p className="text-sm font-medium text-text-primary">
                              {setupConnection.status.charAt(0).toUpperCase() + setupConnection.status.slice(1)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-text-secondary">Connection not found.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-md border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)]">
                    <CardContent className="space-y-3 p-5">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-primary">Setup Button</p>
                        <p className="text-sm text-text-secondary">Launch AWS setup in a new window.</p>
                      </div>
                      <Button
                        className="h-10 rounded-md"
                        onClick={() => window.open("/integrations/aws", "_blank", "noopener,noreferrer")}
                      >
                        Launch AWS Setup
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-10 rounded-md"
                        onClick={() => navigateTo("/client/billing/connect-cloud/aws")}
                      >
                        Back to Setup Choice
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connect-cloud/aws/manual" || activeRoute === "/client/billing/connections/aws/manual" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">AWS MANUAL SETUP</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Manual Setup</h2>
                  <p className="text-sm text-text-secondary">
                    Connect your AWS billing data in one guided setup flow.
                  </p>
                </div>
                <AwsManualSetupSinglePageFlow />
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </>
  )
}
