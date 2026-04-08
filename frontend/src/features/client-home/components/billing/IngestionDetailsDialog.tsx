import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { IngestionStatusPayload } from "@/features/client-home/hooks/useIngestionStatus"

import { normalizeUploadStatusLabel } from "./billingHelpers"

type IngestionDetailsDialogProps = {
  open: boolean
  detailsRunId: string | null
  detailsLoading: boolean
  detailsError: string | null
  detailsStatus: IngestionStatusPayload | null
  onOpenChange: (open: boolean) => void
  onRetry: (runId: string) => void
}

export function IngestionDetailsDialog({
  open,
  detailsRunId,
  detailsLoading,
  detailsError,
  detailsStatus,
  onOpenChange,
  onRetry,
}: IngestionDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ingestion details</DialogTitle>
          <DialogDescription>Run ID: {detailsRunId ?? "N/A"}</DialogDescription>
        </DialogHeader>

        {detailsLoading ? (
          <p className="text-sm text-text-secondary">Loading details...</p>
        ) : detailsError ? (
          <div className="space-y-3">
            <p className="text-sm text-rose-600">{detailsError}</p>
            <Button variant="outline" size="sm" onClick={() => (detailsRunId ? onRetry(detailsRunId) : null)}>
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
  )
}
