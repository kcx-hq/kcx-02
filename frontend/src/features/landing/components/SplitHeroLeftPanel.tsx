import type { ReactNode } from "react"

import { AuroraBackground } from "@/components/brand/AuroraBackground"
import { cn } from "@/lib/utils"

export function SplitHeroLeftPanel({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <aside
      data-header-theme="dark"
      className={cn("relative flex items-center overflow-hidden bg-[#06101a] text-white", className)}
    >
      <div className="absolute inset-0 opacity-70">
        <AuroraBackground />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,12,18,0.86)_0%,rgba(7,14,20,0.78)_48%,rgba(8,16,23,0.94)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(62%_48%_at_78%_18%,rgba(102,210,179,0.14),transparent_72%),radial-gradient(42%_32%_at_14%_20%,rgba(89,144,224,0.14),transparent_72%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:68px_68px]" />

      <div className="relative z-10 w-full">{children}</div>
    </aside>
  )
}

