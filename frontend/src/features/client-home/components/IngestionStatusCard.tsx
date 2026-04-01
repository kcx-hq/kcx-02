import { AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { IngestionStatusCode, IngestionStatusPayload } from "@/features/client-home/hooks/useIngestionStatus"

const STATUS_LABELS: Record<IngestionStatusCode, string> = {
  queued: "Queued",
  validating_schema: "Validating schema",
  reading_rows: "Reading rows",
  normalizing: "Normalizing",
  upserting_dimensions: "Preparing dimensions",
  inserting_facts: "Saving cost records",
  finalizing: "Finalizing",
  completed: "Completed",
  failed: "Failed",
}

const STATUS_MESSAGES: Record<IngestionStatusCode, string> = {
  queued: "Your billing file is queued for processing",
  validating_schema: "Checking file structure",
  reading_rows: "Reading billing rows",
  normalizing: "Standardizing billing fields",
  upserting_dimensions: "Preparing services, accounts, and resources",
  inserting_facts: "Saving cost records",
  finalizing: "Finalizing ingestion",
  completed: "Billing data is ready",
  failed: "We couldn't finish ingestion",
}

function formatLastUpdated(value: string | null | undefined): string {
  if (!value) return "Unknown"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toLocaleString()
}

function formatRowCounts(status: IngestionStatusPayload): string | null {
  const hasCounts = status.rowsRead > 0 || status.rowsLoaded > 0 || status.rowsFailed > 0 || status.totalRowsEstimated
  if (!hasCounts) return null

  const total = status.totalRowsEstimated ?? "?"
  return `Read ${status.rowsRead.toLocaleString()} of ${typeof total === "number" ? total.toLocaleString() : total} rows, loaded ${status.rowsLoaded.toLocaleString()}, failed ${status.rowsFailed.toLocaleString()}`
}

type IngestionStatusCardProps = {
  status: IngestionStatusPayload
  requestError: string | null
  onRetryPoll: () => void
  onRetryIngestion?: () => void
}

export function IngestionStatusCard({
  status,
  requestError,
  onRetryPoll,
  onRetryIngestion,
}: IngestionStatusCardProps) {
  const label = STATUS_LABELS[status.status] ?? "Processing"
  const message = status.statusMessage || STATUS_MESSAGES[status.status] || "Processing billing data"
  const progress = Math.max(0, Math.min(100, Math.round(status.progressPercent)))
  const rowSummary = formatRowCounts(status)
  const isFailed = status.status === "failed"
  const isCompleted = status.status === "completed"

  return (
    <Card className="rounded-md border-[color:var(--kcx-border-soft)] bg-[linear-gradient(160deg,#f7fffb_0%,#ffffff_100%)] shadow-sm-custom">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="kcx-eyebrow text-brand-primary">Billing Ingestion</p>
            <h3 className="text-base font-semibold text-text-primary">{label}</h3>
            <p className="text-sm text-text-secondary">{message}</p>
          </div>
          {isCompleted ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : null}
          {isFailed ? <AlertTriangle className="h-5 w-5 text-rose-600" /> : null}
        </div>

        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--bg-surface)]">
            <div
              className="h-full rounded-full bg-[color:var(--brand-primary)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-text-muted">{progress}% complete</p>
        </div>

        <div className="space-y-1 text-xs text-text-muted">
          {rowSummary ? <p>{rowSummary}</p> : null}
          <p>Last updated: {formatLastUpdated(status.lastUpdatedAt)}</p>
          <p>Processing continues even if you leave this page.</p>
        </div>

        {requestError ? <p className="text-sm text-rose-600">{requestError}</p> : null}

        {isFailed ? (
          <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm font-medium text-rose-700">{status.errorMessage || STATUS_MESSAGES.failed}</p>
            <details className="text-xs text-rose-700/90">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-2 break-words">{status.errorMessage || "No technical error details available."}</p>
            </details>
            <div className="flex gap-2">
              <Button variant="outline" className="h-9 rounded-md" onClick={onRetryPoll}>
                Check status again
              </Button>
              {onRetryIngestion ? (
                <Button className="h-9 rounded-md" onClick={onRetryIngestion}>
                  Retry ingestion
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isFailed && !isCompleted ? (
          <div className="flex">
            <Button variant="outline" className="h-9 rounded-md" onClick={onRetryPoll}>
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
              Refresh status
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
