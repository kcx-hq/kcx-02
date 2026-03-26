import { cn } from "@/lib/utils"

type KcxBrandMarkProps = {
  className?: string
  tone?: "light" | "dark"
}

export function KcxBrandMark({ className, tone = "dark" }: KcxBrandMarkProps) {
  const darkTone = tone === "dark"

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border text-sm font-semibold tracking-[0.06em]",
        darkTone
          ? "border-white/20 bg-[linear-gradient(140deg,rgba(93,194,163,0.28)_0%,rgba(56,112,92,0.72)_100%)] text-[rgba(220,247,236,0.98)]"
          : "border-[rgba(26,54,66,0.18)] bg-[linear-gradient(140deg,rgba(96,174,149,0.32)_0%,rgba(59,122,102,0.92)_100%)] text-white",
        className,
      )}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_24%,rgba(255,255,255,0.4),transparent_56%)]" />
      <span className="relative">KC</span>
    </span>
  )
}
