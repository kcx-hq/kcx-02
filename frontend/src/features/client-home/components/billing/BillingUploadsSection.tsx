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
  const kpiItems = [
    {
      label: "Total Uploads",
      value: String(totalUploads),
      meta: "Billing files in history",
      icon: FileSpreadsheet,
      tone: "text-text-primary",
    },
    {
      label: "Completed",
      value: String(completedCount),
      meta: "Successfully processed",
      icon: CheckCircle2,
      tone: "text-emerald-700",
    },
    {
      label: "Needs Attention",
      value: String(attentionCount),
      meta: "Failed or warning uploads",
      icon: TriangleAlert,
      tone: "text-amber-700",
    },
    {
      label: "Latest File",
      value: latestFile,
      meta: "Auto-processing enabled",
      icon: Clock3,
      tone: "text-text-primary",
    },
  ] as const

  return (
    <section className="rounded-[14px] border border-[color:var(--border-light)] bg-white px-5 py-5 shadow-sm-custom">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-[2rem] font-semibold leading-tight text-text-primary">Upload Files</h1>
       
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="rounded-full border-[rgba(129,170,154,0.35)] bg-[rgba(129,170,154,0.08)] px-3 py-1 text-xs font-medium text-[color:#2b5f54]"
            >
              Status: {compactStatusLabel}
            </Badge>
            <Button className="h-10 rounded-md" onClick={onChooseSource}>
              Upload File
            </Button>
          </div>
        </div>

        <div className="mt-4 border-t border-[color:var(--border-light)] pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {kpiItems.map((item, index) => {
              const Icon = item.icon
              return (
                <article
                  key={item.label}
                  className={
                    index === 0
                      ? "px-4 py-2"
                      : "border-t border-[color:var(--border-light)] px-4 py-2 md:border-l md:border-t-0"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={item.tone === "text-text-primary" ? "text-xs font-semibold uppercase tracking-[0.12em] text-text-muted" : `text-xs font-semibold uppercase tracking-[0.12em] ${item.tone}`}>
                        {item.label}
                      </p>
                      <p className={`mt-2 truncate text-[2rem] font-semibold leading-none ${item.tone}`}>
                        {item.value}
                      </p>
                      <p className={`mt-2 inline-flex items-center gap-1 text-xs ${item.tone === "text-text-primary" ? "text-text-secondary" : item.tone}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {item.meta}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <div className="mt-4 border-t border-[color:var(--border-light)] pt-4">
          <BillingUploadHistorySection
            embedded
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
    </section>
  )
}
