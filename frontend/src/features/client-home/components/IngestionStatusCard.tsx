import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Clock3,
  Loader2,
  PauseCircle,
  RefreshCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { IngestionStatusPayload } from "@/features/client-home/hooks/useIngestionStatus"
import { cn } from "@/lib/utils"

type BillingIngestionUiState = "idle" | "queued" | "processing" | "success" | "warning" | "failed"

type StatusPresentation = {
  title: string
  subtitle: string
  accentClassName: string
  badgeClassName: string
  badgeLabel: string
  icon: typeof PauseCircle
  iconClassName: string
}

type IngestionStatusCode = NonNullable<IngestionStatusPayload>["status"]

const STATUS_MESSAGES: Record<IngestionStatusCode, string> = {
  queued: "Your billing file is queued for processing",
  validating_schema: "Checking file structure",
  reading_rows: "Reading billing rows",
  normalizing: "Standardizing billing fields",
  upserting_dimensions: "Preparing services, accounts, and resources",
  inserting_facts: "Saving cost records",
  finalizing: "Finalizing ingestion",
  completed: "Billing data processed successfully",
  completed_with_warnings: "Billing data processed with warnings",
  failed: "We couldn't finish ingestion",
}

const PRESENTATION_BY_STATE: Record<BillingIngestionUiState, StatusPresentation> = {
  idle: {
    title: "No active billing ingestion",
    subtitle: "Start a new ingestion to process billing data.",
    accentClassName:
      "border-[color:var(--border-light)] bg-[linear-gradient(155deg,#ffffff_0%,#f8faf9_55%,#f3f6f5_100%)]",
    badgeClassName: "border-[color:var(--border-light)] bg-white text-text-secondary",
    badgeLabel: "Idle",
    icon: PauseCircle,
    iconClassName: "text-text-muted",
  },
  queued: {
    title: "Billing ingestion queued",
    subtitle: "Your file is in queue and will begin processing shortly.",
    accentClassName:
      "border-[color:var(--kcx-border-soft)] bg-[linear-gradient(155deg,#f8fcff_0%,#f3f8fc_50%,#ffffff_100%)]",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    badgeLabel: "Queued",
    icon: Clock3,
    iconClassName: "text-sky-600",
  },
  processing: {
    title: "Processing billing data",
    subtitle: "We are reading and normalizing your billing records.",
    accentClassName:
      "border-[color:var(--kcx-border-soft)] bg-[linear-gradient(155deg,#f5fefb_0%,#eef9f5_48%,#ffffff_100%)]",
    badgeClassName: "border-[color:var(--kcx-border-soft)] bg-[color:var(--highlight-green)] text-brand-primary",
    badgeLabel: "Processing",
    icon: Loader2,
    iconClassName: "text-brand-primary",
  },
  success: {
    title: "Billing data processed successfully",
    subtitle: "All billing rows were ingested without row-level failures.",
    accentClassName:
      "border-emerald-200 bg-[linear-gradient(155deg,#f5fff9_0%,#ecf9f1_50%,#ffffff_100%)]",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    badgeLabel: "Success",
    icon: CheckCircle2,
    iconClassName: "text-emerald-600",
  },
  warning: {
    title: "Billing data processed with warnings",
    subtitle: "Processing finished, but some rows were skipped or failed validation.",
    accentClassName:
      "border-amber-200 bg-[linear-gradient(155deg,#fffdf6_0%,#fcf7e7_54%,#ffffff_100%)]",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
    badgeLabel: "Warning",
    icon: AlertTriangle,
    iconClassName: "text-amber-600",
  },
  failed: {
    title: "Billing ingestion failed",
    subtitle: "The ingestion run stopped before completion.",
    accentClassName:
      "border-rose-200 bg-[linear-gradient(155deg,#fff8f8_0%,#fef0f1_50%,#ffffff_100%)]",
    badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
    badgeLabel: "Failed",
    icon: CircleX,
    iconClassName: "text-rose-600",
  },
}

function formatLastUpdated(value: string | null | undefined): string {
  if (!value) return "Unknown"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toLocaleString()
}

function normalizeUiState(status: IngestionStatusPayload | null): BillingIngestionUiState {
  if (!status) return "idle"

  if (status.status === "queued") return "queued"
  if (status.status === "failed") return "failed"
  if (status.status === "completed_with_warnings") return "warning"
  if (status.status === "completed") return status.rowsFailed > 0 ? "warning" : "success"

  return "processing"
}

function formatMetricValue(value: number | string) {
  if (typeof value === "number") {
    return value.toLocaleString()
  }
  return value
}

type IngestionStatusCardProps = {
  status: IngestionStatusPayload | null
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
  const prefersReducedMotion = useReducedMotion()
  const uiState = normalizeUiState(status)
  const presentation = PRESENTATION_BY_STATE[uiState]
  const Icon = presentation.icon

  const progress = status ? Math.max(0, Math.min(100, Math.round(status.progressPercent))) : 0
  const message =
    status && uiState !== "idle"
      ? status.statusMessage || STATUS_MESSAGES[status.status] || presentation.subtitle
      : presentation.subtitle

  const isActiveRun = uiState === "queued" || uiState === "processing"
  const isFailed = uiState === "failed"
  const isIdle = uiState === "idle"
  const canShowMetrics = Boolean(status && !isIdle)
  const totalRows = status?.totalRowsEstimated ?? "?"
  const lastUpdated = formatLastUpdated(status?.lastUpdatedAt)

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? undefined : { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <Card className={cn("relative overflow-hidden rounded-md shadow-sm-custom", presentation.accentClassName)}>
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-white/35 blur-3xl" />
        <CardHeader className="space-y-3 pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="kcx-eyebrow text-brand-primary">Billing Ingestion</p>
              <h3 className="text-lg font-semibold text-text-primary">{presentation.title}</h3>
              <p className="text-sm leading-6 text-text-secondary">{message}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                  presentation.badgeClassName
                )}
              >
                {isActiveRun ? (
                  <motion.span
                    className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                    animate={prefersReducedMotion ? undefined : { opacity: [0.45, 1, 0.45], scale: [1, 1.25, 1] }}
                    transition={prefersReducedMotion ? undefined : { duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                ) : null}
                {presentation.badgeLabel}
              </span>
              <Icon className={cn("h-5 w-5", presentation.iconClassName, uiState === "processing" ? "animate-spin" : "")} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          <AnimatePresence mode="wait" initial={false}>
            {isIdle ? (
              <motion.div
                key="idle"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={prefersReducedMotion ? undefined : { duration: 0.25 }}
                className="space-y-4"
              >
                <div className="rounded-md border border-dashed border-[color:var(--border-light)] bg-white/80 p-4 text-sm text-text-secondary">
                  No ingestion is currently running. Start a new run when your billing export is ready.
                </div>
                {onRetryIngestion ? (
                  <Button className="h-10 rounded-md" onClick={onRetryIngestion}>
                    Start ingestion
                  </Button>
                ) : null}
              </motion.div>
            ) : (
              <motion.div
                key={uiState}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={prefersReducedMotion ? undefined : { duration: 0.25 }}
                className="space-y-4"
                aria-live="polite"
              >
                <div className="space-y-2">
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/80">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        uiState === "failed"
                          ? "bg-rose-500"
                          : uiState === "warning"
                            ? "bg-amber-500"
                            : uiState === "success"
                              ? "bg-emerald-500"
                              : "bg-[color:var(--brand-primary)]"
                      )}
                      initial={prefersReducedMotion ? false : { width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={prefersReducedMotion ? undefined : { duration: 0.45, ease: "easeOut" }}
                    />
                    {isActiveRun ? (
                      <motion.div
                        className="pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                        animate={prefersReducedMotion ? undefined : { x: ["-120%", "420%"] }}
                        transition={prefersReducedMotion ? undefined : { duration: 2.1, repeat: Infinity, ease: "linear" }}
                      />
                    ) : null}
                  </div>
                  <p className="text-xs font-medium text-text-muted">{progress}% complete</p>
                </div>

                {canShowMetrics && status ? (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {[
                      { label: "Total rows", value: typeof totalRows === "number" ? totalRows : "Unknown" },
                      { label: "Loaded", value: status.rowsLoaded },
                      { label: "Failed", value: status.rowsFailed },
                      { label: "Completion", value: `${progress}%` },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-md border border-white/80 bg-white/70 px-3 py-2"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{metric.label}</p>
                        <motion.p
                          key={`${metric.label}-${metric.value}`}
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 3 }}
                          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                          transition={prefersReducedMotion ? undefined : { duration: 0.2 }}
                          className="mt-1 text-sm font-semibold text-text-primary tabular-nums"
                        >
                          {formatMetricValue(metric.value)}
                        </motion.p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-1 text-xs text-text-muted">
                  <p>Last updated: {lastUpdated}</p>
                  {isActiveRun ? <p>Processing continues even if you leave this page.</p> : null}
                </div>

                {requestError ? <p className="text-sm text-rose-600">{requestError}</p> : null}

                {isFailed && status ? (
                  <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 p-3">
                    <p className="text-sm font-medium text-rose-700">{status.errorMessage || STATUS_MESSAGES.failed}</p>
                    <details className="text-xs text-rose-700/90">
                      <summary className="cursor-pointer">Technical details</summary>
                      <p className="mt-2 break-words">{status.errorMessage || "No technical error details available."}</p>
                    </details>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {isActiveRun || isFailed ? (
                    <Button variant="outline" className="h-9 rounded-md" onClick={onRetryPoll}>
                      <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                      Refresh status
                    </Button>
                  ) : null}
                  {onRetryIngestion && (isFailed || uiState === "success" || uiState === "warning") ? (
                    <Button className="h-9 rounded-md" onClick={onRetryIngestion}>
                      Start new ingestion
                    </Button>
                  ) : null}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}
