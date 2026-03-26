import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, Clock3 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { PageFooter } from "@/components/layout/PageFooter"
import { ArticleByline, ArticleShareActions, ArticleTableOfContents, BlogNewsletterCta, BlogPostCard } from "@/features/landing/components/blog"
import { blogSpacing } from "@/features/landing/utils/blogSpacing"
import {
  getBlogPostBySlug,
  getNextBlogPost,
  getRelatedBlogPosts,
  type BlogContentBlock,
} from "@/data/blogPosts"
import { handleAppLinkClick } from "@/lib/navigation"

type BlogDetailPageProps = {
  slug: string
}

type TocItem = {
  id: string
  label: string
  level: 2 | 3
}

function slugifyHeading(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
}

function BlogContent({ blocks, tocItems }: { blocks: BlogContentBlock[]; tocItems: TocItem[] }) {
  let headingCursor = 0
  let previousBlockType: BlogContentBlock["type"] | null = null

  return (
    <div className={`w-full text-[1.03rem] text-text-secondary ${blogSpacing.bodyLineHeight}`}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`

        if (block.type === "paragraph") {
          const marginClass = previousBlockType ? blogSpacing.paragraphTop : ""
          previousBlockType = block.type

          return (
            <p key={key} className={marginClass}>
              {block.text}
            </p>
          )
        }

        if (block.type === "heading") {
          const heading = tocItems[headingCursor]
          headingCursor += 1
          previousBlockType = block.type

          if (block.level === 2) {
            return (
              <h2
                key={key}
                id={heading?.id}
                data-article-heading
                className={`${blogSpacing.headingScrollMargin} ${blogSpacing.h2Top} text-[1.95rem] font-semibold leading-tight tracking-tight text-text-primary md:text-[2.12rem]`}
              >
                {block.text}
              </h2>
            )
          }

          return (
            <h3
              key={key}
              id={heading?.id}
              data-article-heading
              className={`${blogSpacing.headingScrollMargin} ${blogSpacing.h3Top} text-[1.42rem] font-semibold leading-tight tracking-tight text-text-primary`}
            >
              {block.text}
            </h3>
          )
        }

        if (block.type === "list") {
          previousBlockType = block.type

          return (
            <ul key={key} className={`${blogSpacing.listTop} ${blogSpacing.listGap} pl-6 text-[1rem]`}>
              {block.items.map((item) => (
                <li key={item} className="list-disc marker:text-[#2f7f68]">
                  {item}
                </li>
              ))}
            </ul>
          )
        }

        previousBlockType = block.type

        return (
          <aside
            key={key}
            className={`${blogSpacing.calloutTop} rounded-2xl border border-[#bfd8ce] bg-[linear-gradient(135deg,#e8f5f0_0%,#f5fbf8_100%)] ${blogSpacing.calloutPadding}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2f7f68]">{block.title}</p>
            <p className={`${blogSpacing.calloutBodyTop} text-[1rem] leading-7 text-text-secondary`}>{block.text}</p>
          </aside>
        )
      })}
    </div>
  )
}

export function BlogDetailPage({ slug }: BlogDetailPageProps) {
  const post = getBlogPostBySlug(slug)
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle")
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)

  const tocItems = useMemo<TocItem[]>(() => {
    if (!post) return []

    const idCount = new Map<string, number>()

    return post.content
      .filter((block): block is Extract<BlogContentBlock, { type: "heading" }> => block.type === "heading")
      .map((heading) => {
        const baseId = slugifyHeading(heading.text)
        const duplicateCount = idCount.get(baseId) ?? 0
        idCount.set(baseId, duplicateCount + 1)
        const resolvedId = duplicateCount > 0 ? `${baseId}-${duplicateCount + 1}` : baseId

        return {
          id: resolvedId,
          label: heading.text,
          level: heading.level,
        }
      })
  }, [post])

  useEffect(() => {
    if (!tocItems.length) return

    const observedElements = tocItems
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element))

    if (!observedElements.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible[0]?.target.id) {
          setActiveHeadingId(visible[0].target.id)
        }
      },
      {
        rootMargin: "-26% 0px -58% 0px",
        threshold: [0.1, 0.3, 0.55],
      }
    )

    observedElements.forEach((element) => observer.observe(element))
    setActiveHeadingId(tocItems[0]?.id ?? null)

    return () => {
      observer.disconnect()
    }
  }, [tocItems])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyState("copied")
      window.setTimeout(() => setCopyState("idle"), 1600)
    } catch {
      setCopyState("idle")
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title ?? "KCX Insights",
          text: post?.excerpt ?? "Read this article from KCX FinOps Platform",
          url: window.location.href,
        })
        return
      } catch {
        return
      }
    }

    await handleCopyLink()
  }

  if (!post) {
    return (
      <>
        <main data-header-theme="light" className={`bg-bg-main ${blogSpacing.pageBottom} ${blogSpacing.pageTop}`}>
          <section className="mx-auto w-full max-w-4xl px-6 text-center md:px-10">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f7f68]">Article not found</p>
            <h1 className={`text-3xl font-semibold tracking-tight text-text-primary ${blogSpacing.notFoundTitleTop}`}>
              This blog post is unavailable
            </h1>
            <p className={`mx-auto max-w-xl text-base leading-7 text-text-secondary ${blogSpacing.notFoundBodyTop}`}>
              The article may have moved or no longer exists in this environment.
            </p>
            <a
              href="/resources/blog"
              onClick={(event) => handleAppLinkClick(event, "/resources/blog")}
              className={`inline-flex items-center rounded-full border border-border-light bg-white px-5 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-[rgba(62,138,118,0.4)] hover:text-[#2f7f68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${blogSpacing.notFoundCtaTop} ${blogSpacing.inlineIconGap}`}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to insights
            </a>
          </section>
        </main>

        <PageFooter />
      </>
    )
  }

  const relatedPosts = getRelatedBlogPosts(post, 3)
  const nextPost = getNextBlogPost(post)

  return (
    <>
      <main
        data-header-theme="light"
        className={`bg-[linear-gradient(180deg,#f4f6f5_0%,#f6f8f7_34%,#f1f4f3_100%)] ${blogSpacing.pageBottom} ${blogSpacing.pageTop}`}
      >
        <section className="mx-auto w-full max-w-[1140px] px-5 md:px-6">
          <div className={`grid lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,810px)] ${blogSpacing.shellGap}`}>
            <aside className="hidden lg:block">
              <div className={`sticky pr-4 ${blogSpacing.stickyTop}`}>
                <ArticleTableOfContents items={tocItems} activeId={activeHeadingId} />
              </div>
            </aside>

            <article className="min-w-0">
              <div className="max-w-[var(--blog-content-max-width)]">
                <header>
                  <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${blogSpacing.headerTopRowGap}`}>
                    <a
                      href="/resources/blog"
                      onClick={(event) => handleAppLinkClick(event, "/resources/blog")}
                      className={`inline-flex w-fit items-center rounded-full border border-border-light bg-white px-5 py-2.5 text-sm font-semibold text-text-primary transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(62,138,118,0.4)] hover:text-[#2f7f68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${blogSpacing.inlineIconGap}`}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to insights
                    </a>

                    <ArticleShareActions
                      onShare={handleShare}
                      onCopyLink={handleCopyLink}
                      copyState={copyState}
                      grouped
                    />
                  </div>

                  <div
                    className={`flex flex-wrap items-center text-[12px] text-text-muted ${blogSpacing.headerMetaTop} ${blogSpacing.headerMetaGap}`}
                  >
                    <span className="inline-flex rounded-full bg-highlight-green px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#2f7f68]">
                      {post.category}
                    </span>
                    <span className={`inline-flex items-center ${blogSpacing.headerMetaIconGap}`}>
                      <CalendarDays className="h-3.5 w-3.5" />
                      {post.date}
                    </span>
                    <span className={`inline-flex items-center ${blogSpacing.headerMetaIconGap}`}>
                      <Clock3 className="h-3.5 w-3.5" />
                      {post.readTime}
                    </span>
                  </div>

                  <h1 className={`max-w-[24ch] text-[2rem] font-semibold leading-[1.07] tracking-tight text-text-primary md:text-[2.78rem] ${blogSpacing.titleTop}`}>
                    {post.title}
                  </h1>

                  <p className={`max-w-[62ch] text-base leading-8 text-text-secondary md:text-[1.06rem] ${blogSpacing.excerptTop}`}>
                    {post.excerpt}
                  </p>

                  <div className={blogSpacing.authorTop}>
                    <ArticleByline name={post.author.name} role={post.author.role} />
                  </div>
                </header>

                <div
                  className={`rounded-2xl border border-border-light bg-white sm:hidden ${blogSpacing.mobileTocTop} ${blogSpacing.mobileTocPanelPad}`}
                >
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-xl bg-bg-surface px-4 py-3 text-left text-sm font-semibold text-text-primary ${blogSpacing.inlineIconGap}`}
                    onClick={() => setMobileTocOpen((open) => !open)}
                    aria-expanded={mobileTocOpen}
                  >
                    Table of contents
                    <ChevronDown className={`h-4 w-4 transition-transform ${mobileTocOpen ? "rotate-180" : ""}`} />
                  </button>

                  {mobileTocOpen ? (
                    <ArticleTableOfContents
                      items={tocItems}
                      activeId={activeHeadingId}
                      className={blogSpacing.mobileTocExpandedTop}
                    />
                  ) : null}
                </div>
                <figure className={`overflow-hidden rounded-2xl ${blogSpacing.imageTop}`}>
                  <img src={post.imageUrl} alt={post.imageAlt} className="h-[250px] w-full object-cover md:h-[380px]" />
                </figure>

                <div className={blogSpacing.contentTop}>
                  <BlogContent blocks={post.content} tocItems={tocItems} />
                </div>

                <footer
                  className={`flex flex-col border-t border-[#d4dcda] md:flex-row md:items-center md:justify-between ${blogSpacing.bottomActionsTop} ${blogSpacing.bottomActionsPadTop} ${blogSpacing.actionRowGap}`}
                >
                  <div className={`flex flex-wrap items-center ${blogSpacing.actionGroupGap}`}>
                    {nextPost ? (
                      <a
                        href={nextPost.href}
                        onClick={(event) => handleAppLinkClick(event, nextPost.href)}
                        className={`inline-flex items-center rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${blogSpacing.inlineIconGap}`}
                      >
                        Next article
                        <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                    ) : null}

                    <a
                      href="/resources/blog"
                      onClick={(event) => handleAppLinkClick(event, "/resources/blog")}
                      className={`inline-flex items-center rounded-full border border-border-light bg-white px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:border-[rgba(62,138,118,0.4)] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${blogSpacing.inlineIconGap}`}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Back to insights
                    </a>
                  </div>

                  <ArticleShareActions
                    onShare={handleShare}
                    onCopyLink={handleCopyLink}
                    copyState={copyState}
                    showCopy={false}
                  />
                </footer>
              </div>
            </article>
          </div>
        </section>

        <section className={`mx-auto w-full max-w-6xl px-6 md:px-10 ${blogSpacing.relatedTop}`}>
          <div className={`flex flex-col sm:flex-row sm:items-end sm:justify-between ${blogSpacing.relatedHeaderGap}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f7f68]">Related reads</p>
              <h2 className={`text-2xl font-semibold tracking-tight text-text-primary md:text-3xl ${blogSpacing.relatedTitleTop}`}>
                Continue with practical FinOps guidance
              </h2>
            </div>

            <a
              href="/resources/blog"
              onClick={(event) => handleAppLinkClick(event, "/resources/blog")}
              className={`inline-flex items-center text-sm font-semibold text-[#2f7f68] transition-colors hover:text-[#266954] ${blogSpacing.inlineIconGap}`}
            >
              View all articles
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className={`grid sm:grid-cols-2 xl:grid-cols-3 ${blogSpacing.relatedGridTop} ${blogSpacing.relatedCardGap}`}>
            {relatedPosts.map((relatedPost, index) => (
              <BlogPostCard
                key={relatedPost.id}
                post={relatedPost}
                variant={index === 0 || relatedPost.isPopular ? "highlight" : "default"}
                density="compact"
              />
            ))}
          </div>
        </section>

        <section className={`mx-auto w-full max-w-6xl px-6 md:px-10 ${blogSpacing.ctaTop}`}>
          <BlogNewsletterCta />
        </section>
      </main>

      <PageFooter />
    </>
  )
}
