import { useMemo, useState } from "react"

import { PageFooter } from "@/components/layout/PageFooter"
import { BlogFeaturedArticle, BlogHero, BlogNewsletterCta, BlogPostCard } from "@/features/landing/components/blog"
import { blogSpacing } from "@/features/landing/utils/blogSpacing"
import { BLOG_CATEGORIES, BLOG_POSTS, FEATURED_BLOG_POST } from "@/data/blogPosts"

export function BlogPage() {
  const [activeCategory, setActiveCategory] = useState<string>(BLOG_CATEGORIES[0])
  const [searchQuery, setSearchQuery] = useState("")

  const filteredPosts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return BLOG_POSTS.filter((post) => {
      const categoryMatch = activeCategory === "All topics" || post.category === activeCategory
      const searchMatch =
        normalizedQuery.length === 0 ||
        [post.title, post.excerpt, post.category, post.author.name].some((field) =>
          field.toLowerCase().includes(normalizedQuery)
        )

      return categoryMatch && searchMatch
    })
  }, [activeCategory, searchQuery])

  return (
    <>
      <BlogHero
        categories={BLOG_CATEGORIES}
        activeCategory={activeCategory}
        onActiveCategoryChange={setActiveCategory}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      <main data-header-theme="light" className="bg-[linear-gradient(180deg,#f2f3f2_0%,#f5f7f6_34%,#f1f5f3_100%)]">
        <section className={`${blogSpacing.pageBottom} ${blogSpacing.sectionTop}`}>
          <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
            <div className={`flex flex-col md:flex-row md:items-end md:justify-between ${blogSpacing.relatedHeaderGap}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f7f68]">Featured insight</p>
                <h2 className={`text-2xl font-semibold tracking-tight text-text-primary md:text-3xl ${blogSpacing.relatedTitleTop}`}>
                  Editorial pick from KCX FinOps Lab
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-text-secondary md:text-base">
                One deep dive selected by our FinOps advisory team for immediate operational impact.
              </p>
            </div>

            <div className={blogSpacing.relatedGridTop}>
              <BlogFeaturedArticle post={FEATURED_BLOG_POST} />
            </div>
          </div>
        </section>

        <section className={blogSpacing.pageBottom}>
          <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
            <div className={`flex flex-col md:flex-row md:items-end md:justify-between ${blogSpacing.relatedHeaderGap}`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f7f68]">Latest articles</p>
                <h2 className={`text-2xl font-semibold tracking-tight text-text-primary md:text-3xl ${blogSpacing.relatedTitleTop}`}>
                  Insights to optimize cloud economics at scale
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-text-secondary md:text-base">
                {filteredPosts.length} article{filteredPosts.length === 1 ? "" : "s"} found for your current
                filters.
              </p>
            </div>

            {filteredPosts.length > 0 ? (
              <div
                className={`grid sm:grid-cols-2 xl:grid-cols-3 ${blogSpacing.relatedGridTop} ${blogSpacing.relatedGridGapY} ${blogSpacing.relatedGridGapX}`}
              >
                {filteredPosts.map((post, index) => (
                  <BlogPostCard
                    key={post.id}
                    post={post}
                    variant={index < 2 || post.isPopular ? "highlight" : "default"}
                  />
                ))}
              </div>
            ) : (
              <div className={`${blogSpacing.relatedGridTop} rounded-2xl border border-border-light bg-white p-8 text-center shadow-sm-custom`}>
                <h3 className="text-xl font-semibold text-text-primary">No matching articles yet</h3>
                <p className={`mx-auto max-w-lg text-sm leading-7 text-text-secondary ${blogSpacing.relatedEmptyBodyTop}`}>
                  Try a different keyword or switch to another category to discover related FinOps guidance.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className={blogSpacing.pageBottom}>
          <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
            <BlogNewsletterCta />
          </div>
        </section>
      </main>

      <PageFooter />
    </>
  )
}
