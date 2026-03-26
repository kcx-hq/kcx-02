import { ArrowRight } from "lucide-react"

import type { BlogPost } from "@/data/blogPosts"
import { handleAppLinkClick } from "@/lib/navigation"

type BlogFeaturedArticleProps = {
  post: BlogPost
  onNavigate?: () => void
}

export function BlogFeaturedArticle({ post, onNavigate }: BlogFeaturedArticleProps) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-border-light bg-bg-surface shadow-[0_24px_44px_rgba(14,30,26,0.11)]">
      <div className="grid gap-0 lg:grid-cols-[0.98fr_1.02fr]">
        <div className="relative h-full min-h-[280px] overflow-hidden lg:min-h-[420px]">
          <img
            src={post.imageUrl}
            alt={post.imageAlt}
            className="h-full w-full object-cover transition-transform duration-700 ease-out hover:scale-[1.02]"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,16,21,0.05)_14%,rgba(6,12,18,0.44)_100%)]" />
        </div>

        <div className="flex h-full flex-col p-7 md:p-9">
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-text-muted md:text-sm">
            <span className="inline-flex rounded-full bg-highlight-green px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#2f7f68]">
              {post.category}
            </span>
            <time>{post.date}</time>
            <span aria-hidden="true">•</span>
            <span>{post.readTime}</span>
          </div>

          <h2 className="mt-6 max-w-[24ch] text-[1.95rem] font-semibold leading-[1.15] tracking-tight text-text-primary md:text-[2.35rem]">
            {post.title}
          </h2>
          <p className="mt-5 max-w-[50ch] text-base leading-7 text-text-secondary">{post.excerpt}</p>

          <div className="mt-6 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">{post.author.name}</p>
            <p>{post.author.role}</p>
          </div>

          <a
            href={post.href}
            onClick={(event) => handleAppLinkClick(event, post.href, onNavigate)}
            className="mt-9 inline-flex w-fit items-center gap-2 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Read featured article
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  )
}
