import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

type NavItemProps = {
  label: string
  active?: boolean
  shellTone: "light" | "dark"
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function NavItem({
  label,
  active,
  shellTone,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-none px-2.5 py-2 text-[13px] font-medium tracking-[0.02em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        shellTone === "dark"
          ? active
            ? "text-white"
            : "text-white/80 hover:text-white"
          : active
            ? "text-slate-900"
            : "text-slate-600 hover:text-slate-900"
      )}
      aria-haspopup="menu"
      aria-expanded={active}
    >
      {label}
      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", active && "rotate-180")} />
    </button>
  )
}
