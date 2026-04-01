// STEP 1:
// Client prepares billing data source (S3 bucket)
// This feeds into cross-account access setup in Step 2

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, ArrowRight, CheckCircle2, Cloud, ExternalLink, FileSpreadsheet, Loader2, Plus, Wrench } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  submitAwsManualStep1,
  submitAwsManualStep2,
  submitAwsManualStep3,
  validateAwsManualConnection,
} from "@/features/client-home/api/cloud-connections.api"
import { AwsManualSetupStepTwo } from "@/features/client-home/components/AwsManualSetupStepTwo"
import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"
import { ApiError } from "@/lib/api"
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
    href: "/client/billing/connections",
    description: "Manage providers and integration setup paths.",
    icon: Cloud,
  },
] as const

const CONNECTIONS: Array<{
  name: string
  provider: string
  status: string
  lastChecked: string
  stage: string
}> = []

const PROVIDERS = [
  { name: "AWS", icon: "/aws.svg", availability: "Available", href: "/client/billing/connections/aws" },
  { name: "Azure", icon: "/azure.svg", availability: "Beta" },
  { name: "GCP", icon: "/gcp.svg", availability: "Available Soon" },
  { name: "Oracle Cloud", icon: "/oracle.svg", availability: "Planned" },
  { name: "Custom", icon: "/icons/core-platform.png", availability: "Planned" },
] as const

const ADD_CONNECTION_PROVIDERS = [
  { name: "AWS", icon: "/aws.svg", availability: "Available", description: "Connect AWS billing for cost ingestion.", href: "/client/billing/connections/aws" },
  { name: "Azure", icon: "/azure.svg", availability: "Beta", description: "Azure billing integration is currently in beta." },
  { name: "GCP", icon: "/gcp.svg", availability: "Planned", description: "GCP billing integration will be available soon." },
  { name: "Oracle Cloud", icon: "/oracle.svg", availability: "Planned", description: "Oracle billing integration will be available soon." },
  { name: "Custom", icon: "/icons/core-platform.png", availability: "Planned", description: "Custom source ingestion is planned." },
] as const

function isCloudConnectionsRoute(path: string) {
  return path.startsWith("/client/billing/connections")
}

function ConnectionStatusBadge({ status }: { status: string }) {
  if (status === "Healthy") {
    return <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700">Healthy</Badge>
  }
  if (status === "Pending First Ingest") {
    return <Badge variant="outline" className="rounded-md border-amber-200 bg-amber-50 text-amber-700">Pending</Badge>
  }
  if (status === "Failed") {
    return <Badge variant="outline" className="rounded-md border-rose-200 bg-rose-50 text-rose-700">Failed</Badge>
  }
  return <Badge variant="outline" className="rounded-md border-slate-300 bg-slate-100 text-slate-700">Not Available</Badge>
}

function ProviderCard({
  name,
  icon,
  availability,
  href,
}: {
  name: string
  icon: string
  availability: string
  href?: string
}) {
  const isClickable = Boolean(href)
  const cardClassName = cn(
    "rounded-md border border-[color:var(--border-light)] bg-white p-4 transition-colors",
    isClickable ? "hover:border-[color:var(--kcx-border-soft)] hover:bg-[color:var(--bg-surface)]" : "opacity-90"
  )

  const content = (
    <div className={cardClassName}>
      <div className="flex items-center justify-between">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
          <img src={icon} alt={name} className="h-5 w-5 object-contain" />
        </span>
        <Badge
          variant="outline"
          className={cn(
            "rounded-md",
            availability === "Available"
              ? "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary"
              : "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-muted"
          )}
        >
          {availability}
        </Badge>
      </div>
      <p className="mt-3 text-sm font-semibold text-text-primary">{name}</p>
    </div>
  )

  if (!href) return content
  return (
    <a href={href} onClick={(event) => handleAppLinkClick(event, href)}>
      {content}
    </a>
  )
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
  const isEnabled = availability === "Available" && Boolean(href)
  const className = cn(
    "h-full rounded-md border bg-white p-5 transition-colors",
    isEnabled
      ? "border-[color:var(--kcx-border-soft)] hover:bg-[color:var(--bg-surface)] hover:border-[color:var(--kcx-border-strong)]"
      : "border-[color:var(--border-light)]"
  )

  const content = (
    <div className={className}>
      <div className="flex items-center justify-between">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)]">
          <img src={icon} alt={name} className="h-5 w-5 object-contain" />
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
      <h3 className="mt-4 text-base font-semibold text-text-primary">{name}</h3>
      <p className="mt-1.5 min-h-[3rem] text-sm leading-6 text-text-secondary">{description}</p>
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
  const activeRoute = route === "/client/billing" ? "/client/billing/connections" : route

  return (
    <>
      <ClientPageHeader
        eyebrow="Billing Workspace"
        title="Billing"
        description="Manage uploads, cloud connections, and billing ingestion workflows."
      />

      <section aria-label="Billing workspace options" className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <CardContent className="p-3">
            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Billing Modules</p>
            <ul className="space-y-1.5">
              {BILLING_OPTIONS.map((option) => {
                const isActive =
                  option.href === "/client/billing/connections" ? isCloudConnectionsRoute(activeRoute) : option.href === activeRoute
                const OptionIcon = option.icon

                return (
                  <li key={option.href}>
                    <a
                      href={option.href}
                      onClick={(event) => handleAppLinkClick(event, option.href)}
                      className={cn(
                        "block rounded-md border px-3 py-2.5 transition-colors",
                        isActive
                          ? "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)]"
                          : "border-transparent hover:border-[color:var(--border-light)] hover:bg-[color:var(--bg-surface)]"
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-md border",
                            isActive
                              ? "border-[color:var(--kcx-border-soft)] bg-white text-brand-primary"
                              : "border-[color:var(--border-light)] bg-white text-text-muted"
                          )}
                        >
                          <OptionIcon className="h-3.5 w-3.5" />
                        </span>
                        <div className="space-y-0.5">
                          <p className={cn("text-sm", isActive ? "font-semibold text-text-primary" : "font-medium text-text-secondary")}>
                            {option.label}
                          </p>
                          <p className="text-xs leading-5 text-text-muted">{option.description}</p>
                        </div>
                      </div>
                    </a>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>

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

            {activeRoute === "/client/billing/connections" ? (
              <>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <p className="kcx-eyebrow text-brand-primary">Cloud Connections</p>
                    <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Cloud Connections</h2>
                    <p className="text-sm text-text-secondary">
                      Manage connected cloud accounts, monitor setup status, and start new billing integrations.
                    </p>
                  </div>
                  <Button className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connections/add")}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add Connection
                  </Button>
                </div>

                <section className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-text-primary">Current Connections</h3>
                    <p className="text-sm text-text-secondary">Live view of billing integration health and ingestion state.</p>
                  </div>
                  {CONNECTIONS.length < 1 ? (
                    <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-6">
                      <p className="text-sm text-text-secondary">No active cloud connections found. Connected accounts will appear here once billing integration is configured.</p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-[color:var(--border-light)]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Connection Name</TableHead>
                            <TableHead>Provider</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Last Checked</TableHead>
                            <TableHead>Last Success / Stage</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {CONNECTIONS.map((connection) => (
                            <TableRow key={connection.name}>
                              <TableCell className="font-medium text-text-primary">{connection.name}</TableCell>
                              <TableCell>{connection.provider}</TableCell>
                              <TableCell><ConnectionStatusBadge status={connection.status} /></TableCell>
                              <TableCell>{connection.lastChecked}</TableCell>
                              <TableCell>{connection.stage}</TableCell>
                              <TableCell>
                                <Button variant="ghost" className="h-8 rounded-md px-2 text-sm text-text-secondary">
                                  View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>

                <section className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-text-primary">Add a New Connection</h3>
                    <p className="text-sm text-text-secondary">Choose a provider to begin a new billing connection.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                    {PROVIDERS.map((provider) => (
                      <ProviderCard key={provider.name} {...provider} />
                    ))}
                  </div>
                </section>
              </>
            ) : null}

            {activeRoute === "/client/billing/connections/add" ? (
              <>
                <div className="space-y-2">
                  <p className="kcx-eyebrow text-brand-primary">Add Connection</p>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-primary">Choose Cloud Provider</h2>
                  <p className="text-sm text-text-secondary">
                    Select a cloud provider to begin a new billing integration setup.
                  </p>
                </div>
                <div className="grid grid-cols-1 auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {ADD_CONNECTION_PROVIDERS.map((provider) => (
                    <AddConnectionProviderCard key={provider.name} {...provider} />
                  ))}
                </div>
                <div className="border-t border-[color:var(--border-light)] pt-4">
                  <Button variant="ghost" className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connections")}>
                    <ArrowRight className="mr-1.5 h-4 w-4 rotate-180" />
                    Back to Cloud Connections
                  </Button>
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connections/aws" ? (
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
                      <h3 className="text-base font-semibold text-text-primary">Automatic Setup</h3>
                      <p className="text-sm text-text-secondary">Guided cloud-native onboarding with secure automated provisioning.</p>
                      <Button variant="outline" className="h-10 rounded-md border-[color:var(--border-light)]" disabled>
                        Beta
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
                      <Button className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connections/aws/manual")}>
                        Start Manual Setup
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}

            {activeRoute === "/client/billing/connections/aws/manual" ||
            activeRoute === "/client/billing/connections/aws/manual/step-2" ||
            activeRoute === "/client/billing/connections/aws/manual/step-3" ? (
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
