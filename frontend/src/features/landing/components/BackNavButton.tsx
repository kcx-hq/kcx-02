import { ChevronLeft } from "lucide-react"

import { navigateTo } from "@/lib/navigation"
import { cn } from "@/lib/utils"

type BackNavButtonProps = {
  fallbackHref?: string
  className?: string
}

export function BackNavButton({ fallbackHref = "/", className }: BackNavButtonProps) {
  const handleBack = () => {
    const hasBackEntry = window.history.length > 1
    const currentPath = window.location.pathname

    if (hasBackEntry) {
      window.history.back()
      window.setTimeout(() => {
        if (window.location.pathname === currentPath) {
          navigateTo(fallbackHref, { replace: true })
        }
      }, 120)
      return
    }

    navigateTo(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Go to previous page"
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center text-[rgba(220,239,233,0.96)] transition-opacity duration-200 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(126,223,194,0.6)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06101a]",
        className
      )}
    >
      <ChevronLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2.4} />
    </button>
  )
}
