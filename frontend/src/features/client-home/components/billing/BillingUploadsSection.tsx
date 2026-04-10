import type { TenantUploadHistoryRecord } from "@/features/client-home/api/upload-history.api"
import { BillingUploadHistorySection } from "@/features/client-home/components/BillingUploadHistorySection"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock3, FileSpreadsheet, TriangleAlert } from "lucide-react"

type BillingUploadsSectionProps = {
  compactStatusLabel: string
  uploadHistoryRecords: TenantUploadHistoryRecord[]
  isUploadHistoryLoading: boolean
  isUploadHistoryError: boolean
  uploadHistoryErrorMessage: string
  dashboardActionError: string | null
  dashboardActionLoading: boolean
  onChooseSource: () => void
  onRetryUploadHistory: () => void
  onViewUploadDetails: (runId: string) => void
  onRetryUploadRecord: (record: TenantUploadHistoryRecord) => void
  onOpenDashboard: (selectedRawBillingFileIds: number[]) => void
}

export function BillingUploadsSection({
  compactStatusLabel,
  uploadHistoryRecords,
  isUploadHistoryLoading,
  isUploadHistoryError,
  uploadHistoryErrorMessage,
  dashboardActionError,
  dashboardActionLoading,
  onChooseSource,
  onRetryUploadHistory,
  onViewUploadDetails,
  onRetryUploadRecord,
  onOpenDashboard,
}: BillingUploadsSectionProps) {
  const totalUploads = uploadHistoryRecords.length
  const completedCount = uploadHistoryRecords.filter((record) => record.status === "completed").length
  const attentionCount = uploadHistoryRecords.filter(
    (record) => record.status === "failed" || record.status === "warning" || record.status === "completed_with_warnings"
  ).length
  const latestFile = uploadHistoryRecords[0]?.fileName ?? "No uploads yet"

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[color:var(--border-light)] bg-[linear-gradient(180deg,#ffffff_0%,#f7fbfa_100%)] p-5 shadow-sm-custom">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="kcx-eyebrow text-brand-primary">Billing Workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Upload Files</h1>
            <p className="max-w-3xl text-sm text-text-secondary">
              Upload CSV files from local storage or temporary S3 access, then launch dashboards from selected files.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-full border-[rgba(129,170,154,0.35)] bg-[rgba(129,170,154,0.08)] px-3 py-1 text-xs font-medium text-[color:#2b5f54]"
            >
              Status: {compactStatusLabel}
            </Badge>
            <Button className="h-10 rounded-md" onClick={onChooseSource}>
              Choose Source
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-[color:var(--border-light)] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Total Uploads</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">{totalUploads}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-text-secondary">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Billing files in history
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{completedCount}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Successfully processed
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700">Needs Attention</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{attentionCount}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700">
              <TriangleAlert className="h-3.5 w-3.5" />
              Failed or warning uploads
            </p>
          </div>

          <div className="rounded-lg border border-[color:var(--border-light)] bg-white p-4">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Latest File</p>
            <p className="mt-1 truncate text-sm font-semibold text-text-primary">{latestFile}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-text-secondary">
              <Clock3 className="h-3.5 w-3.5" />
              Auto-processing enabled
            </p>
          </div>
        </div>
      </section>

      <BillingUploadHistorySection
        records={uploadHistoryRecords}
        isLoading={isUploadHistoryLoading}
        isError={isUploadHistoryError}
        errorMessage={uploadHistoryErrorMessage}
        dashboardActionError={dashboardActionError}
        dashboardActionLoading={dashboardActionLoading}
        onRetry={onRetryUploadHistory}
        onViewDetails={onViewUploadDetails}
        onRetryUpload={onRetryUploadRecord}
        onOpenDashboard={onOpenDashboard}
      />
    </div>
  )
}
