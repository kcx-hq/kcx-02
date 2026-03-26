import { blogSpacing } from "@/features/landing/utils/blogSpacing"

type ArticleBylineProps = {
  name: string
  role: string
}

function initialsFromName(name: string) {
  const segments = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)

  if (!segments.length) return "AU"
  return segments.map((segment) => segment[0]?.toUpperCase() ?? "").join("")
}

export function ArticleByline({ name, role }: ArticleBylineProps) {
  return (
    <div className={`inline-flex items-center ${blogSpacing.authorInlineGap}`}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(62,138,118,0.13)] text-[10px] font-semibold tracking-[0.04em] text-[#2f7f68]">
        {initialsFromName(name)}
      </span>

      <p className="text-[0.95rem] leading-6 text-text-secondary">
        <span className="font-semibold text-text-primary">{name}</span>
        <span className="px-2 text-text-muted" aria-hidden="true">
          •
        </span>
        <span className="text-text-muted">{role}</span>
      </p>
    </div>
  )
}
