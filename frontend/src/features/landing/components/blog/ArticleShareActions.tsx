import { Check, Link2, Share2 } from "lucide-react"

import { blogSpacing } from "@/features/landing/utils/blogSpacing"

type ArticleShareActionsProps = {
  onShare: () => void
  onCopyLink: () => void
  copyState: "idle" | "copied"
  compact?: boolean
  showCopy?: boolean
  grouped?: boolean
}

export function ArticleShareActions({
  onShare,
  onCopyLink,
  copyState,
  compact = false,
  showCopy = true,
  grouped = false,
}: ArticleShareActionsProps) {
  const baseButtonClass = `inline-flex items-center rounded-full border border-border-light bg-white text-text-secondary transition-colors hover:border-[rgba(62,138,118,0.35)] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${blogSpacing.inlineIconGap}`

  return (
    <div
      className={`flex items-center ${blogSpacing.actionGroupGap} ${compact ? "" : "flex-wrap"} ${
        grouped ? "rounded-full border border-border-light bg-white p-1" : ""
      }`}
    >
      <button
        type="button"
        onClick={onShare}
        className={`${baseButtonClass} ${grouped ? "border-transparent shadow-none" : ""} ${compact ? "px-3.5 py-2 text-xs" : "px-4 py-2 text-sm"}`}
      >
        <Share2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        Share
      </button>

      {showCopy ? (
        <button
          type="button"
          onClick={onCopyLink}
          className={`${baseButtonClass} ${grouped ? "border-transparent shadow-none" : ""} ${compact ? "px-3.5 py-2 text-xs" : "px-4 py-2 text-sm"}`}
        >
          {copyState === "copied" ? (
            <>
              <Check className={compact ? "h-3.5 w-3.5 text-[#2f7f68]" : "h-4 w-4 text-[#2f7f68]"} />
              Copied
            </>
          ) : (
            <>
              <Link2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              Copy link
            </>
          )}
        </button>
      ) : null}
    </div>
  )
}
