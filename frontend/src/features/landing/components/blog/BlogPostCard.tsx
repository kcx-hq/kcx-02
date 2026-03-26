import { ArrowRight, Sparkles } from "lucide-react"

import type { BlogPost } from "@/data/blogPosts"
import { handleAppLinkClick } from "@/lib/navigation"

type BlogPostCardProps = {
  post: BlogPost
  variant?: "default" | "highlight"
  density?: "default" | "compact"
  onNavigate?: () => void
}

export function BlogPostCard({
  post,
  variant = "default",
  density = "default",
  onNavigate,
}: BlogPostCardProps) {
  const highlight = variant === "highlight"
  const compact = density === "compact"

  return (
    <article className="h-full">
      <a
        href={post.href}
        onClick={(event) => handleAppLinkClick(event, post.href, onNavigate)}
        className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          highlight
            ? "border-[rgba(84,154,132,0.38)] shadow-[0_16px_30px_rgba(17,38,32,0.1)]"
            : "border-border-light shadow-sm-custom"
        } hover:-translate-y-1 hover:border-[rgba(62,138,118,0.42)] hover:shadow-[0_22px_36px_rgba(17,38,32,0.18)]`}
      >
        {highlight ? (
          <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-[rgba(6,19,27,0.84)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c5eede]">
            <Sparkles className="h-3 w-3" />
            Popular
          </span>
        ) : null}

        <div className="relative overflow-hidden">
          <img
            src={post.imageUrl}
            alt={post.imageAlt}
            className={`w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035] ${
              compact ? "h-40" : highlight ? "h-52" : "h-48"
            }`}
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,14,18,0)_38%,rgba(7,14,18,0.36)_100%)]" />
        </div>

        <div className={`flex flex-1 flex-col ${compact ? "p-4 md:p-5" : "p-5 md:p-6"}`}>
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-text-muted">
            <span className="inline-flex rounded-full bg-highlight-green px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#2f7f68] md:text-[11px]">
              {post.category}
            </span>
            <time>{post.date}</time>
            <span aria-hidden="true">•</span>
            <span>{post.readTime}</span>
          </div>

          <h3 className={`mt-5 max-w-[26ch] font-semibold text-text-primary ${compact ? "text-lg leading-7" : "text-xl leading-7"}`}>
            {post.title}
          </h3>
          <p className={`mt-3 max-w-[42ch] flex-1 text-sm text-text-secondary ${compact ? "leading-6" : "leading-6"}`}>
            {post.excerpt}
          </p>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="text-xs text-text-secondary">
              <p className="font-semibold text-text-primary">{post.author.name}</p>
              <p>{post.author.role}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2f7f68] transition-colors group-hover:text-[#246854]">
              Read article
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </a>
    </article>
  )
}
