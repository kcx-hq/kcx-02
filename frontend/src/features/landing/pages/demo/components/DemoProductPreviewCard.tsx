import { Play } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function DemoProductPreviewCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "kcx-surface-card-dark group relative overflow-hidden rounded-[22px] p-5 md:p-6",
        "transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transform-none",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(44%_46%_at_22%_18%,rgba(102,210,179,0.16),transparent_70%),radial-gradient(42%_38%_at_84%_78%,rgba(86,152,200,0.12),transparent_72%)] opacity-[0.9]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(170,225,207,0.9)]">
          Product preview
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(226,240,236,0.14)] bg-[rgba(1,7,13,0.45)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex items-center gap-1.5 border-b border-[rgba(226,240,236,0.12)] bg-[rgba(7,18,28,0.55)] px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-[rgba(255,255,255,0.2)]" />
            <span className="h-2 w-2 rounded-full bg-[rgba(255,255,255,0.16)]" />
            <span className="h-2 w-2 rounded-full bg-[rgba(255,255,255,0.12)]" />
            <span className="ml-2 text-[11px] font-medium text-[rgba(214,230,226,0.72)]">KCX — cost intelligence</span>
          </div>

          <div className="relative aspect-[16/10]">
            <img
              src="/dashboard-client-dashboard.png"
              alt="KCX product dashboard preview"
              className="absolute inset-0 h-full w-full object-cover opacity-[0.92]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,11,17,0.06)_0%,rgba(5,11,17,0.6)_92%)]" />

            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
              <p className="text-xs text-[rgba(230,244,240,0.82)]">
                A quick view of spend, anomalies, and owner context.
              </p>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-9 rounded-xl border-[rgba(226,240,236,0.22)] bg-[rgba(255,255,255,0.06)] px-3 text-xs text-white",
                  "shadow-[0_12px_30px_-18px_rgba(0,7,14,0.9)] backdrop-blur-sm",
                  "transition duration-200 hover:bg-[rgba(255,255,255,0.12)]"
                )}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Watch 45s
              </Button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-[rgba(214,230,226,0.82)]">
          See how KCX connects raw billing data to teams, features, and savings levers.
        </p>
      </div>
    </div>
  )
}

