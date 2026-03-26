import { ListTree } from "lucide-react"

import { BLOG_SCROLL_OFFSET_PX, blogSpacing } from "@/features/landing/utils/blogSpacing"

type TocItem = {
  id: string
  label: string
  level: 2 | 3
}

type ArticleTableOfContentsProps = {
  items: TocItem[]
  activeId: string | null
  className?: string
}

export function ArticleTableOfContents({ items, activeId, className }: ArticleTableOfContentsProps) {
  if (items.length === 0) return null

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id)
    if (!element) return

    const y = element.getBoundingClientRect().top + window.scrollY - BLOG_SCROLL_OFFSET_PX
    window.scrollTo({ top: y, behavior: "smooth" })
  }

  return (
    <nav className={className} aria-label="Table of contents">
      <div
        className={`flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f7f68] ${blogSpacing.tocLabelGap}`}
      >
        <ListTree className="h-3.5 w-3.5" />
        On this page
      </div>

      <ul
        className={`border-l border-[#c7d4cf] ${blogSpacing.tocListTop} ${blogSpacing.tocListGap} ${blogSpacing.tocListPad}`}
      >
        {items.map((item) => {
          const isActive = item.id === activeId

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => scrollToHeading(item.id)}
                className={`relative w-full rounded-lg text-left text-[13px] leading-[1.45] transition-all duration-150 ${blogSpacing.tocItemPadX} ${blogSpacing.tocItemPadY} ${
                  isActive
                    ? "bg-[rgba(216,238,230,0.84)] font-semibold text-[#143128] shadow-[inset_0_0_0_1px_rgba(41,110,90,0.18)]"
                    : "font-medium text-text-secondary hover:bg-white/90 hover:text-text-primary"
                } ${item.level === 3 ? blogSpacing.tocItemLevel3Pad : ""}`}
                aria-current={isActive ? "location" : undefined}
              >
                <span
                  className={`absolute inset-y-1 left-0 w-[4px] rounded-full transition-colors ${
                    isActive ? "bg-[#2a725d]" : "bg-transparent"
                  }`}
                />
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
