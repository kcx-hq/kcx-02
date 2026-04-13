import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export const CLIENT_PAGE_CONTENT_MAX_WIDTH_CLASS = "mx-auto w-full max-w-[1120px]"
export const CLIENT_PAGE_SECTION_SPACING_CLASS = "space-y-4 md:space-y-5"
export const CLIENT_PAGE_CARD_PADDING_CLASS = "p-4 md:p-5"

type ClientPageContentContainerProps = {
  children: ReactNode
  className?: string
}

export function ClientPageContentContainer({ children, className }: ClientPageContentContainerProps) {
  return <div className={cn(CLIENT_PAGE_CONTENT_MAX_WIDTH_CLASS, className)}>{children}</div>
}

