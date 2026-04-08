import type { BillingUploadNormalizedStatus } from "@/modules/billing-uploads/admin-billing-uploads.api"
import { cn } from "@/shared/utils"

type UploadProgressIndicatorProps = {
  status: BillingUploadNormalizedStatus | null | undefined
  progressPercent: number | null | undefined
}

type StatusTone = {
  dot: string
  subtleText: string
}

function getStatusTone(status: BillingUploadNormalizedStatus | null | undefined): StatusTone {
  if (status === "completed") {
    return {
      dot: "bg-[color:rgba(38,107,90,0.95)]",
      subtleText: "text-[color:rgba(38,107,90,0.98)]",
    }
  }
  if (status === "warning") {
    return {
      dot: "bg-[color:rgba(180,83,9,0.95)]",
      subtleText: "text-[color:rgba(146,64,14,0.98)]",
    }
  }
  if (status === "failed") {
    return {
      dot: "bg-[color:rgba(185,28,28,0.95)]",
      subtleText: "text-[color:rgba(153,27,27,0.95)]",
    }
  }
  if (status === "processing") {
    return {
      dot: "bg-[color:rgba(30,64,175,0.92)]",
      subtleText: "text-[color:rgba(30,64,175,0.95)]",
    }
  }
  return {
    dot: "bg-[color:rgba(71,85,105,0.75)]",
    subtleText: "text-[color:rgba(51,65,85,0.92)]",
  }
}

function getStatusLabel(status: BillingUploadNormalizedStatus | null | undefined): string | null {
  if (!status) return null
  if (status === "completed") return "Completed"
  if (status === "processing") return "Processing"
  if (status === "failed") return "Failed"
  if (status === "warning") return "Warning"
  if (status === "queued") return "Queued"
  return null
}

function normalizeProgress(progressPercent: number | null | undefined): number | null {
  if (typeof progressPercent !== "number" || !Number.isFinite(progressPercent)) return null
  return Math.max(0, Math.min(100, progressPercent))
}

export function UploadProgressIndicator({ status, progressPercent }: UploadProgressIndicatorProps) {
  const progress = normalizeProgress(progressPercent)
  const statusLabel = getStatusLabel(status)
  const tone = getStatusTone(status)

  if (!statusLabel && progress === null) {
    return <span className="text-sm text-[color:rgba(15,23,42,0.55)]">-</span>
  }

  const text = progress !== null ? `${progress}%` : statusLabel

  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={cn("text-xs font-medium tabular-nums", tone.subtleText)}>{text}</span>
      {progress !== null ? (
        <span className="h-1 w-10 overflow-hidden rounded-full bg-[color:rgba(15,23,42,0.08)]">
          <span
            className={cn("block h-full rounded-full", tone.dot)}
            style={{ width: `${progress}%` }}
          />
        </span>
      ) : null}
    </div>
  )
}
