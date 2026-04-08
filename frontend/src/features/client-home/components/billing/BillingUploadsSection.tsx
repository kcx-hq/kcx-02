import type { TenantUploadHistoryRecord } from "@/features/client-home/api/upload-history.api"
import { BillingUploadHistorySection } from "@/features/client-home/components/BillingUploadHistorySection"
import { Button } from "@/components/ui/button"

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
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">Billing</h1>
          <p className="text-sm text-text-secondary">
            Choose how you want to provide billing files from your device or temporary S3 access.
          </p>
        </div>
        <Button className="h-10 rounded-md" onClick={onChooseSource}>
          Choose Source
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
        onRetry={onRetryUploadHistory}
        onViewDetails={onViewUploadDetails}
        onRetryUpload={onRetryUploadRecord}
        onOpenDashboard={onOpenDashboard}
      />
    </>
  )
}
