import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"

// STEP 1:
// Client prepares billing data source (S3 bucket)
// This feeds into cross-account access setup in Step 2

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Cloud,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Folder,
  Loader2,
  Wrench,
} from "lucide-react"

import {
  browseAwsManualBucket,
  type AwsManualBrowseBucketItem,
  testAwsManualConnection,
} from "@/features/client-home/api/cloud-connections.api"
import type { TenantUploadHistoryRecord } from "@/features/client-home/api/upload-history.api"
import { AwsManualSetupStepTwo } from "@/features/client-home/components/AwsManualSetupStepTwo"
import { BillingUploadHistorySection } from "@/features/client-home/components/BillingUploadHistorySection"
import { ManualBillingUploadDialog } from "@/features/client-home/components/ManualBillingUploadDialog"
import { useIngestionStatus, type IngestionStatusPayload } from "@/features/client-home/hooks/useIngestionStatus"
import {
  TENANT_UPLOAD_HISTORY_QUERY_KEY,
  useTenantUploadHistory,
} from "@/features/client-home/hooks/useTenantUploadHistory"
import { ClientPageHeader } from "@/features/client-home/components/ClientPageHeader"
import { useUploadHistorySelectionStore } from "@/features/client-home/stores/uploadHistorySelection.store"
import { dashboardApi } from "@/features/dashboard/api/dashboardApi"
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

const ACTIVE_INGESTION_STORAGE_KEY = "kcx.activeBillingIngestionRunId"

function normalizeUploadStatusLabel(value: string | null | undefined): "Idle" | "Queued" | "Processing" | "Completed" | "Warning" | "Failed" {
  if (!value) return "Idle"
  if (value === "queued") return "Queued"
  if (value === "completed") return "Completed"
  if (value === "completed_with_warnings" || value === "warning") return "Warning"
  if (value === "failed") return "Failed"
  return "Processing"
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
      <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Quick steps</p>
        <ol className="mt-2 space-y-1.5 text-sm text-text-secondary">
          <li>1. Open AWS Billing Console.</li>
          <li>2. Navigate to <span className="font-semibold text-text-primary">Data Exports</span>.</li>
          <li>3. Start creating a new standard export.</li>
        </ol>
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
  expectedAccountId: string
  onConnectionNameChange: (value: string) => void
  onDataExportNameChange: (value: string) => void
  onRoleArnChange: (value: string) => void
  onExpectedAccountIdChange: (value: string) => void
  roleNameHint: string
}

function ManualSetupStepThree({
  connectionName,
  dataExportName,
  roleArn,
  expectedAccountId,
  onConnectionNameChange,
  onDataExportNameChange,
  onRoleArnChange,
  onExpectedAccountIdChange,
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

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
              Expected AWS Account ID (optional)
            </span>
            <input
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[color:var(--kcx-border-strong)]"
              placeholder="123456789012"
              value={expectedAccountId}
              onChange={(event) => onExpectedAccountIdChange(event.target.value)}
            />
            <p className="text-xs text-text-muted">
              Optional: if provided, KCX will verify the assumed role belongs to this account.
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

function normalizeExplorerPrefix(value: string): string {
  const trimmed = value.trim().replace(/^\/+/, "")
  if (!trimmed) return ""
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`
}

function formatFileSize(size: number | null): string {
  if (size === null || Number.isNaN(size)) return "-"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatLastModified(value: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function AwsBucketBrowserModal({
  open,
  onOpenChange,
  bucketName,
  rootPrefix,
  currentPrefix,
  items,
  isLoading,
  errorMessage,
  callerAccount,
  onOpenPrefix,
  onReload,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  bucketName: string
  rootPrefix: string
  currentPrefix: string
  items: AwsManualBrowseBucketItem[]
  isLoading: boolean
  errorMessage: string | null
  callerAccount: string | null
  onOpenPrefix: (prefix: string) => void
  onReload: () => void
}) {
  const normalizedCurrentPrefix = normalizeExplorerPrefix(currentPrefix)
  const breadcrumbParts = normalizedCurrentPrefix
    .split("/")
    .filter((segment) => segment.length > 0)

  const folderItems = items.filter((item) => item.type === "folder")
  const fileItems = items.filter((item) => item.type === "file")
  const sortedItems = [...folderItems, ...fileItems]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,72rem)] max-w-[72rem] p-0">
        <div className="border-b border-[color:var(--border-light)] bg-[linear-gradient(160deg,#0f2b24_0%,#1b3f35_58%,#25574b_100%)] px-6 py-5 text-white">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-semibold text-white">Browse Connected Billing Bucket</DialogTitle>
            <DialogDescription className="text-sm text-white/85">
              Review the contents of the connected S3 export path to confirm successful access.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/85">
            <span className="rounded-md border border-white/20 bg-white/10 px-2 py-1">Bucket: {bucketName}</span>
            <span className="rounded-md border border-white/20 bg-white/10 px-2 py-1">
              Root Prefix: {normalizeExplorerPrefix(rootPrefix) || "/"}
            </span>
            {callerAccount ? (
              <span className="rounded-md border border-white/20 bg-white/10 px-2 py-1">Account: {callerAccount}</span>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3">
            <div className="flex flex-wrap items-center gap-1 text-xs text-text-secondary">
              <button
                type="button"
                className="rounded px-1.5 py-0.5 font-medium text-brand-primary hover:bg-[color:var(--highlight-green)]"
                onClick={() => onOpenPrefix("")}
              >
                bucket root
              </button>
              {breadcrumbParts.map((part, index) => {
                const targetPrefix = `${breadcrumbParts.slice(0, index + 1).join("/")}/`
                return (
                  <div key={targetPrefix} className="inline-flex items-center gap-1">
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 font-medium text-brand-primary hover:bg-[color:var(--highlight-green)]"
                      onClick={() => onOpenPrefix(targetPrefix)}
                    >
                      {part}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-[color:var(--border-light)]">
            <div className="grid grid-cols-[minmax(0,1fr)_120px_180px_120px] bg-[color:var(--bg-surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
              <p>Name</p>
              <p>Type</p>
              <p>Last Modified</p>
              <p className="text-right">Size</p>
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading bucket contents...
              </div>
            ) : errorMessage ? (
              <div className="flex items-start gap-2 px-4 py-4 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <p>{errorMessage}</p>
              </div>
            ) : sortedItems.length === 0 ? (
              <div className="px-4 py-8 text-sm text-text-secondary">No objects found in this path.</div>
            ) : (
              <div className="divide-y divide-[color:var(--border-light)]">
                {sortedItems.map((item) => (
                  <div
                    key={`${item.type}:${item.key}`}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_120px_180px_120px] items-center gap-2 px-4 py-3 text-sm",
                      item.type === "folder" ? "bg-white" : "bg-[color:var(--bg-surface)]",
                    )}
                  >
                    <div className="min-w-0">
                      {item.type === "folder" ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-left font-medium text-brand-primary hover:underline"
                          onClick={() => onOpenPrefix(item.path)}
                        >
                          <Folder className="h-4 w-4" />
                          <span className="truncate">{item.name}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-text-primary">
                          <FileText className="h-4 w-4 text-text-muted" />
                          <span className="truncate">{item.name}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-text-secondary">{item.type}</p>
                    <p className="text-text-secondary">{formatLastModified(item.lastModified)}</p>
                    <p className="text-right text-text-secondary">{item.type === "folder" ? "-" : formatFileSize(item.size)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-light)] pt-2">
            <Button type="button" variant="outline" className="h-10 rounded-md" onClick={onReload} disabled={isLoading}>
              Reload
            </Button>
            <Button type="button" className="h-10 rounded-md" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
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
  onContinue,
  validateStatus,
  validationMessage,
  isBrowsingBucket,
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
  onContinue: () => void
  validateStatus: "idle" | "validating" | "success" | "failure"
  validationMessage: string | null
  isBrowsingBucket: boolean
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
        <div className="flex items-center gap-2">
          {validateStatus === "success" ? (
            <Button type="button" variant="outline" className="h-10 rounded-md" onClick={onContinue} disabled={isBrowsingBucket}>
              {isBrowsingBucket ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Loading bucket...
                </>
              ) : (
                "Continue"
              )}
            </Button>
          ) : null}
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
    </div>
  )
}

function AwsManualSetupSinglePageFlow() {
  const authUser = getAuthUser()

  const [viewMode, setViewMode] = useState<"setup" | "review">("setup")
  const [bucketName, setBucketName] = useState("")
  const [pathPrefix, setPathPrefix] = useState("")
  const [externalId, setExternalId] = useState("")
  const [roleName, setRoleName] = useState("")
  const [customPolicyName, setCustomPolicyName] = useState("")
  const [connectionName, setConnectionName] = useState("")
  const [dataExportName, setDataExportName] = useState("")
  const [roleArn, setRoleArn] = useState("")
  const [expectedAccountId, setExpectedAccountId] = useState("")
  const [finishError, setFinishError] = useState<string | null>(null)
  const [isSubmittingFinish, setIsSubmittingFinish] = useState(false)
  const [validateStatus, setValidateStatus] = useState<"idle" | "validating" | "success" | "failure">("idle")
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [validatedAccountId, setValidatedAccountId] = useState<string | null>(null)
  const [isBucketModalOpen, setIsBucketModalOpen] = useState(false)
  const [bucketBrowsePrefix, setBucketBrowsePrefix] = useState("")
  const [bucketBrowseItems, setBucketBrowseItems] = useState<AwsManualBrowseBucketItem[]>([])
  const [bucketBrowseError, setBucketBrowseError] = useState<string | null>(null)
  const [isBucketBrowseLoading, setIsBucketBrowseLoading] = useState(false)

  const flowStorageKey = useMemo(
    () => `kcx_aws_manual_flow_user_${authUser?.id ?? "anonymous"}`,
    [authUser?.id],
  )

  useEffect(() => {
    const existing = localStorage.getItem(flowStorageKey)
    if (!existing) return

    try {
      const parsed = JSON.parse(existing) as {
        bucketName?: string
        pathPrefix?: string
        externalId?: string
        roleName?: string
        customPolicyName?: string
        connectionName?: string
        dataExportName?: string
        roleArn?: string
        expectedAccountId?: string
      }
      setBucketName(typeof parsed.bucketName === "string" ? parsed.bucketName : "")
      setPathPrefix(typeof parsed.pathPrefix === "string" ? parsed.pathPrefix : "")
      setExternalId(typeof parsed.externalId === "string" ? parsed.externalId : "")
      setRoleName(typeof parsed.roleName === "string" ? parsed.roleName : "")
      setCustomPolicyName(typeof parsed.customPolicyName === "string" ? parsed.customPolicyName : "")
      setConnectionName(typeof parsed.connectionName === "string" ? parsed.connectionName : "")
      setDataExportName(typeof parsed.dataExportName === "string" ? parsed.dataExportName : "")
      setRoleArn(typeof parsed.roleArn === "string" ? parsed.roleArn : "")
      setExpectedAccountId(typeof parsed.expectedAccountId === "string" ? parsed.expectedAccountId : "")
    } catch {
      // Ignore malformed local storage payload.
    }
  }, [flowStorageKey])

  useEffect(() => {
    const payload = {
      bucketName: bucketName.trim(),
      pathPrefix: pathPrefix.trim(),
      externalId: externalId.trim(),
      roleName: roleName.trim(),
      customPolicyName: customPolicyName.trim(),
      connectionName: connectionName.trim(),
      dataExportName: dataExportName.trim(),
      roleArn: roleArn.trim(),
      expectedAccountId: expectedAccountId.trim(),
    }
    localStorage.setItem(flowStorageKey, JSON.stringify(payload))
  }, [bucketName, connectionName, customPolicyName, dataExportName, expectedAccountId, externalId, flowStorageKey, pathPrefix, roleArn, roleName])

  const hasBucketName = bucketName.trim().length > 0
  const hasNoSpacesInBucketName = !/\s/.test(bucketName)
  const showBucketFormatHint = hasBucketName && !hasNoSpacesInBucketName

  const isStep1Complete = hasBucketName && hasNoSpacesInBucketName
  const isStep2Complete = roleName.trim().length > 0 && customPolicyName.trim().length > 0
  const isStep3Complete = connectionName.trim().length > 0 && dataExportName.trim().length > 0 && roleArn.trim().length > 0
  const isAllComplete = isStep1Complete && isStep2Complete && isStep3Complete

  async function handleFinishSetup() {
    if (!isAllComplete || isSubmittingFinish) return

    setFinishError(null)
    setValidatedAccountId(null)
    setIsSubmittingFinish(true)

    try {
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

      const result = await testAwsManualConnection({
        connectionName: connectionName.trim(),
        reportName: dataExportName.trim(),
        roleArn: roleArn.trim(),
        externalId: externalIdForSubmit,
        bucketName: bucketName.trim(),
        ...(pathPrefix.trim().length > 0 ? { prefix: pathPrefix.trim() } : {}),
      })

      setValidateStatus(result.success ? "success" : "failure")
      setValidatedAccountId(result.accountId ?? null)
      setValidationMessage(
        result.success
          ? `AssumeRole succeeded. Account: ${result.accountId ?? "unknown"}`
          : mapValidationErrorMessage("Connection validation failed."),
      )
      setViewMode("review")
    } catch (error) {
      setValidatedAccountId(null)
      console.error("[AWS Manual Setup][Finish Setup] Failed", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      })
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setFinishError("Your session appears expired. Please log in again, then retry validation.")
          return
        }
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
    if (validateStatus === "validating") return

    setValidateStatus("validating")
    setValidationMessage(null)
    setBucketBrowseError(null)

    try {
      const normalizedExternalId = externalId.trim()
      const externalIdStorageKey = `kcx_aws_external_id_user_${authUser?.id ?? "anonymous"}`
      const fallbackExternalId = localStorage.getItem(externalIdStorageKey)?.trim() ?? ""
      const externalIdForSubmit = normalizedExternalId || fallbackExternalId

      if (!externalIdForSubmit) {
        throw new Error("External ID is missing. Return to Step 2 and regenerate it.")
      }

      const result = await testAwsManualConnection({
        connectionName: connectionName.trim(),
        reportName: dataExportName.trim(),
        roleArn: roleArn.trim(),
        externalId: externalIdForSubmit,
        bucketName: bucketName.trim(),
        ...(pathPrefix.trim().length > 0 ? { prefix: pathPrefix.trim() } : {}),
      })

      if (result.success) {
        setValidateStatus("success")
        setValidatedAccountId(result.accountId ?? null)
        setValidationMessage("Connection verified successfully. AWS integration is active.")
      } else {
        setValidateStatus("failure")
        setValidatedAccountId(null)
        setValidationMessage(mapValidationErrorMessage("Validation failed. Review configuration and retry."))
      }
    } catch (error) {
      console.error("[AWS Manual Setup][Validate] Failed", {
        roleArn: roleArn.trim(),
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      })
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setValidateStatus("failure")
          setValidatedAccountId(null)
          setValidationMessage("Your session appears expired. Please log in again, then retry validation.")
          return
        }
        setValidateStatus("failure")
        setValidatedAccountId(null)
        setValidationMessage(mapValidationErrorMessage(error.message || "Validation failed."))
      } else {
        setValidateStatus("failure")
        setValidatedAccountId(null)
        setValidationMessage("Validation failed. Review configuration and retry.")
      }
    }
  }

  async function loadBucketContents(targetPrefix?: string) {
    if (isBucketBrowseLoading) return

    const normalizedExternalId = externalId.trim()
    const externalIdStorageKey = `kcx_aws_external_id_user_${authUser?.id ?? "anonymous"}`
    const fallbackExternalId = localStorage.getItem(externalIdStorageKey)?.trim() ?? ""
    const externalIdForSubmit = normalizedExternalId || fallbackExternalId

    if (!externalIdForSubmit) {
      setBucketBrowseError("External ID is missing. Return to Step 2 and regenerate it.")
      return
    }

    const effectivePrefix =
      typeof targetPrefix === "string" ? targetPrefix : bucketBrowsePrefix || normalizeExplorerPrefix(pathPrefix)

    setIsBucketBrowseLoading(true)
    setBucketBrowseError(null)

    try {
      const result = await browseAwsManualBucket({
        roleArn: roleArn.trim(),
        externalId: externalIdForSubmit,
        bucketName: bucketName.trim(),
        prefix: effectivePrefix,
      })

      setBucketBrowsePrefix(result.prefix)
      setBucketBrowseItems(result.items)
      setBucketBrowseError(null)
      if (result.callerIdentity?.account) {
        setValidatedAccountId(result.callerIdentity.account)
      }
    } catch (error) {
      console.error("[AWS Manual Setup][Browse Bucket] Failed", {
        bucketName: bucketName.trim(),
        prefix: effectivePrefix,
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      })
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setBucketBrowseError("Your session appears expired. Please log in again, then retry.")
          return
        }
        setBucketBrowseError(error.message || "Could not load S3 bucket contents.")
      } else {
        setBucketBrowseError("Could not load S3 bucket contents.")
      }
    } finally {
      setIsBucketBrowseLoading(false)
    }
  }

  async function handleContinueToBucketExplorer() {
    setIsBucketModalOpen(true)
    const startPrefix = bucketBrowsePrefix || normalizeExplorerPrefix(pathPrefix)
    await loadBucketContents(startPrefix)
  }

  if (viewMode === "review") {
    return (
      <>
        <AwsSetupReviewValidation
          bucketName={bucketName.trim()}
          pathPrefix={pathPrefix.trim()}
          externalId={externalId.trim()}
          roleName={roleName.trim()}
          customPolicyName={customPolicyName.trim()}
          connectionName={connectionName.trim()}
          dataExportName={dataExportName.trim()}
          roleArn={roleArn.trim()}
          onBackToEdit={() => {
            setIsBucketModalOpen(false)
            setViewMode("setup")
          }}
          onValidate={() => {
            void handleValidateConnection()
          }}
          onContinue={() => {
            void handleContinueToBucketExplorer()
          }}
          validateStatus={validateStatus}
          validationMessage={validationMessage}
          isBrowsingBucket={isBucketBrowseLoading}
        />
        <AwsBucketBrowserModal
          open={isBucketModalOpen}
          onOpenChange={setIsBucketModalOpen}
          bucketName={bucketName.trim()}
          rootPrefix={pathPrefix.trim()}
          currentPrefix={bucketBrowsePrefix}
          items={bucketBrowseItems}
          isLoading={isBucketBrowseLoading}
          errorMessage={bucketBrowseError}
          callerAccount={validatedAccountId}
          onOpenPrefix={(nextPrefix) => {
            void loadBucketContents(nextPrefix)
          }}
          onReload={() => {
            void loadBucketContents(bucketBrowsePrefix)
          }}
        />
      </>
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
          {isStep1Complete ? <p className="text-sm text-text-secondary">Step 1 complete.</p> : null}
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
          expectedAccountId={expectedAccountId}
          onConnectionNameChange={setConnectionName}
          onDataExportNameChange={setDataExportName}
          onRoleArnChange={setRoleArn}
          onExpectedAccountIdChange={setExpectedAccountId}
          roleNameHint={roleName.trim()}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          className="h-10 rounded-md"
          disabled={!isAllComplete || isSubmittingFinish}
          onClick={() => {
            void handleFinishSetup()
          }}
        >
          {isSubmittingFinish ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Testing connection...
            </>
          ) : (
            "Test Connection"
          )}
        </Button>
      </div>
      {finishError ? <p className="text-sm text-rose-700">{finishError}</p> : null}
    </div>
  )
}
export function ClientBillingPage() {
  const queryClient = useQueryClient()
  const route = useCurrentRoute()
  const activeRoute = route
  const isBillingHubRoute = activeRoute === "/client/billing"
  const isBillingUploadsRoute = activeRoute === "/client/billing/uploads"
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
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [activeIngestionRunId, setActiveIngestionRunId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem(ACTIVE_INGESTION_STORAGE_KEY)
  })
  const [latestActiveIngestionLoaded, setLatestActiveIngestionLoaded] = useState(false)
  const [lastTerminalIngestionStatus, setLastTerminalIngestionStatus] = useState<IngestionStatusPayload | null>(null)

  const setupConnectionId = useMemo(() => {
    const match = AWS_SETUP_ROUTE_REGEX.exec(activeRoute)
    if (!match) return null
    return match[1]
  }, [activeRoute])

  const [setupConnection, setSetupConnection] = useState<CloudConnection | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  const {
    status: ingestionStatus,
  } = useIngestionStatus({
    ingestionRunId: activeIngestionRunId,
    enabled: Boolean(activeIngestionRunId),
    onIngestionRunNotFound: () => {
      setActiveIngestionRunId(null)
      window.localStorage.removeItem(ACTIVE_INGESTION_STORAGE_KEY)
    },
  })
  const displayIngestionStatus = ingestionStatus ?? lastTerminalIngestionStatus
  const {
    data: uploadHistoryRecords = [],
    isLoading: isUploadHistoryLoading,
    isError: isUploadHistoryError,
    error: uploadHistoryError,
    refetch: refetchUploadHistory,
  } = useTenantUploadHistory(isBillingUploadsRoute)
  const [dashboardActionLoading, setDashboardActionLoading] = useState(false)
  const [dashboardActionError, setDashboardActionError] = useState<string | null>(null)
  const retainOnlyFiles = useUploadHistorySelectionStore((state) => state.retainOnlyFiles)
  const clearSelectedFiles = useUploadHistorySelectionStore((state) => state.clearSelectedFiles)
  const uploadHistoryErrorMessage = uploadHistoryError instanceof ApiError ? uploadHistoryError.message : "Failed to load upload history"
  const [detailsRunId, setDetailsRunId] = useState<string | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [detailsStatus, setDetailsStatus] = useState<IngestionStatusPayload | null>(null)
  const compactStatusLabel = useMemo(() => {
    if (displayIngestionStatus?.status) {
      return normalizeUploadStatusLabel(displayIngestionStatus.status)
    }
    const latestStatus = uploadHistoryRecords[0]?.status
    return normalizeUploadStatusLabel(latestStatus)
  }, [displayIngestionStatus, uploadHistoryRecords])

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

  useEffect(() => {
    if (latestActiveIngestionLoaded || activeIngestionRunId) return

    void (async () => {
      try {
        const latestActive = await apiGet<IngestionStatusPayload | null>("/billing/ingestions/latest-active")
        if (latestActive?.id) {
          setActiveIngestionRunId(latestActive.id)
          setLastTerminalIngestionStatus(null)
          window.localStorage.setItem(ACTIVE_INGESTION_STORAGE_KEY, latestActive.id)
        }
      } catch {
        // Best-effort recovery path for reloads with missing local storage state.
      } finally {
        setLatestActiveIngestionLoaded(true)
      }
    })()
  }, [activeIngestionRunId, latestActiveIngestionLoaded])

  useEffect(() => {
    if (!ingestionStatus) return

    const isTerminalStatus =
      ingestionStatus.status === "completed" ||
      ingestionStatus.status === "completed_with_warnings" ||
      ingestionStatus.status === "failed"

    if (isTerminalStatus) {
      setLastTerminalIngestionStatus(ingestionStatus)
      if (activeIngestionRunId) {
        window.localStorage.removeItem(ACTIVE_INGESTION_STORAGE_KEY)
        setActiveIngestionRunId(null)
      }
      return
    }

    if (activeIngestionRunId && window.localStorage.getItem(ACTIVE_INGESTION_STORAGE_KEY) !== activeIngestionRunId) {
      window.localStorage.setItem(ACTIVE_INGESTION_STORAGE_KEY, activeIngestionRunId)
    }
  }, [activeIngestionRunId, ingestionStatus])

  useEffect(() => {
    const availableRawBillingFileIds = uploadHistoryRecords
      .map((record) => Number(record.rawBillingFileId))
      .filter((rawBillingFileId) => Number.isInteger(rawBillingFileId))
    retainOnlyFiles(availableRawBillingFileIds)
  }, [retainOnlyFiles, uploadHistoryRecords])

  useEffect(() => {
    if (!isBillingUploadsRoute) {
      clearSelectedFiles()
      setDashboardActionError(null)
    }
  }, [clearSelectedFiles, isBillingUploadsRoute])

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

  function handleIngestionQueued(payload: { ingestionRunId: string }) {
    setLastTerminalIngestionStatus(null)
    setActiveIngestionRunId(payload.ingestionRunId)
    window.localStorage.setItem(ACTIVE_INGESTION_STORAGE_KEY, payload.ingestionRunId)
    void queryClient.invalidateQueries({ queryKey: TENANT_UPLOAD_HISTORY_QUERY_KEY })
  }

  function handleRetryUploadRecord(_record: TenantUploadHistoryRecord) {
    setUploadDialogOpen(true)
  }

  function handleViewUploadDetails(runId: string) {
    setDetailsRunId(runId)
    setDetailsDialogOpen(true)
    setDetailsLoading(true)
    setDetailsError(null)
    setDetailsStatus(null)

    void (async () => {
      try {
        const status = await apiGet<IngestionStatusPayload>(`/billing/ingestions/${runId}/status`)
        setDetailsStatus(status)
      } catch (error) {
        if (error instanceof ApiError) {
          setDetailsError(error.message || "Failed to load ingestion details")
        } else {
          setDetailsError("Failed to load ingestion details")
        }
      } finally {
        setDetailsLoading(false)
      }
    })()
  }

  function openDashboardWithQuery(search: URLSearchParams) {
    const nextUrl = `/dashboard/overview?${search.toString()}`
    window.history.pushState({}, "", nextUrl)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }

  function handleOpenDashboard(selectedRawBillingFileIds: number[]) {
    if (dashboardActionLoading) return

    const validRawBillingFileIds = [...new Set(selectedRawBillingFileIds.filter((id) => Number.isInteger(id)))]
    if (validRawBillingFileIds.length === 0) {
      setDashboardActionError("Select at least one uploaded file to open dashboard.")
      return
    }

    setDashboardActionError(null)
    setDashboardActionLoading(true)

    void (async () => {
      try {
        await dashboardApi.getScope({
          rawBillingFileIds: validRawBillingFileIds,
        })

        const query = new URLSearchParams({
          rawBillingFileIds: validRawBillingFileIds.join(","),
        })
        openDashboardWithQuery(query)
      } catch (error) {
        if (error instanceof ApiError) {
          setDashboardActionError(error.message || "Unable to resolve upload scope for dashboard.")
        } else {
          setDashboardActionError("Unable to resolve upload scope for dashboard.")
        }
      } finally {
        setDashboardActionLoading(false)
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
      {!isBillingUploadsRoute ? (
        <>
          <ClientPageHeader
            eyebrow="Billing Workspace"
            title={pageHeaderTitle}
            description={pageHeaderDescription}
          />
        </>
      ) : null}

      <section aria-label="Billing workspace options">
        <Card className="rounded-md border-[color:var(--border-light)] bg-white shadow-sm-custom">
          <CardContent className="space-y-6 p-6">
            {isBillingUploadsRoute ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Billing</h1>
                    <p className="text-sm text-text-secondary">
                      Upload billing files. Processing starts automatically after upload.
                    </p>
                  </div>
                  <Button className="h-10 rounded-md" onClick={() => setUploadDialogOpen(true)}>
                    Upload File
                  </Button>
                </div>
                <div className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] px-4 py-2.5">
                  <p className="text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">Status:</span> {compactStatusLabel} · Auto-processing on
                  </p>
                </div>
                <BillingUploadHistorySection
                  records={uploadHistoryRecords}
                  isLoading={isUploadHistoryLoading}
                  isError={isUploadHistoryError}
                  errorMessage={uploadHistoryErrorMessage}
                  dashboardActionError={dashboardActionError}
                  dashboardActionLoading={dashboardActionLoading}
                  onRetry={() => void refetchUploadHistory()}
                  onViewDetails={handleViewUploadDetails}
                  onRetryUpload={handleRetryUploadRecord}
                  onOpenDashboard={handleOpenDashboard}
                />
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
                      <p className="text-sm text-text-secondary">Guided manual setup using custom trust policy and IAM role validation.</p>
                      <Button className="h-10 rounded-md" onClick={() => navigateTo("/client/billing/connect-cloud/aws/manual")}>
                        Open Manual Setup
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
                  <p className="kcx-eyebrow text-brand-primary">AWS Manual Setup</p>
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
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ingestion details</DialogTitle>
            <DialogDescription>
              Run ID: {detailsRunId ?? "N/A"}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <p className="text-sm text-text-secondary">Loading details...</p>
          ) : detailsError ? (
            <div className="space-y-3">
              <p className="text-sm text-rose-600">{detailsError}</p>
              <Button variant="outline" size="sm" onClick={() => detailsRunId ? handleViewUploadDetails(detailsRunId) : null}>
                Retry
              </Button>
            </div>
          ) : detailsStatus ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Status</p>
                  <p className="font-medium text-text-primary">{normalizeUploadStatusLabel(detailsStatus.status)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Progress</p>
                  <p className="font-medium text-text-primary">{Math.round(detailsStatus.progressPercent)}%</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Rows Loaded</p>
                  <p className="font-medium text-text-primary">{detailsStatus.rowsLoaded}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Rows Failed</p>
                  <p className="font-medium text-text-primary">{detailsStatus.rowsFailed}</p>
                </div>
              </div>
              {detailsStatus.statusMessage ? (
                <p className="rounded-md border border-[color:var(--border-light)] bg-[color:var(--bg-surface)] p-3 text-text-secondary">
                  {detailsStatus.statusMessage}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No details available for this ingestion run.</p>
          )}
        </DialogContent>
      </Dialog>
      <ManualBillingUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onIngestionQueued={handleIngestionQueued}
      />
    </>
  )
}
