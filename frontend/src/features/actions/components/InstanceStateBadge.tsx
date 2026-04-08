import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type InstanceStateBadgeProps = {
  state: string | null
}

const STATE_BADGE_CLASS_BY_STATE: Record<string, string> = {
  running: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-sky-200 bg-sky-50 text-sky-700",
  stopped: "border-slate-200 bg-slate-100 text-slate-700",
  stopping: "border-amber-200 bg-amber-50 text-amber-700",
  "shutting-down": "border-orange-200 bg-orange-50 text-orange-700",
  terminated: "border-rose-200 bg-rose-50 text-rose-700",
}

export function InstanceStateBadge({ state }: InstanceStateBadgeProps) {
  const normalizedState = String(state ?? "").trim().toLowerCase()
  const fallbackState = normalizedState || "unknown"

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md capitalize",
        STATE_BADGE_CLASS_BY_STATE[normalizedState] ??
          "border-[color:var(--border-light)] bg-[color:var(--bg-surface)] text-text-secondary",
      )}
    >
      {fallbackState}
    </Badge>
  )
}
