import { Search } from "lucide-react"

import { AuroraBackground } from "@/components/brand/AuroraBackground"

type BlogHeroProps = {
  categories: readonly string[]
  activeCategory: string
  onActiveCategoryChange: (category: string) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
}

export function BlogHero({
  categories,
  activeCategory,
  onActiveCategoryChange,
  searchQuery,
  onSearchQueryChange,
}: BlogHeroProps) {
  return (
    <section
      data-header-theme="dark"
      className="relative isolate overflow-hidden border-b border-white/10 bg-[#06101a] pb-14 pt-28 text-white md:pb-16 md:pt-34"
    >
      <div className="absolute inset-0 opacity-70">
        <AuroraBackground />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,12,18,0.82)_0%,rgba(7,14,20,0.76)_48%,rgba(8,16,23,0.94)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(62%_48%_at_78%_18%,rgba(102,210,179,0.14),transparent_72%),radial-gradient(42%_32%_at_14%_20%,rgba(89,144,224,0.14),transparent_72%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:68px_68px]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 md:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(151,228,203,0.92)]">
          Resources / Insights Hub
        </p>
        <h1 className="mt-5 max-w-4xl text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
          FinOps Intelligence for Cloud-First Leaders
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-[rgba(214,230,226,0.84)] md:text-lg">
          Playbooks, benchmarks, and operational guidance from the KCX FinOps Platform team to help you optimize
          spend, improve accountability, and scale cloud with confidence.
        </p>

        <form className="mt-8" onSubmit={(event) => event.preventDefault()} role="search" aria-label="Search blog">
          <label htmlFor="blog-search" className="relative block w-full max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[rgba(178,220,207,0.88)]" />
            <input
              id="blog-search"
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search FinOps guides, cost optimization, and governance..."
              className="w-full rounded-2xl border border-white/20 bg-white/[0.06] py-3 pl-11 pr-4 text-sm text-white shadow-[0_14px_35px_rgba(2,8,14,0.34)] backdrop-blur-md transition-all duration-200 placeholder:text-[rgba(182,205,199,0.7)] focus:border-[rgba(144,227,198,0.8)] focus:shadow-[0_0_0_3px_rgba(102,210,179,0.18),0_14px_35px_rgba(2,8,14,0.34)] focus:outline-none md:text-base"
            />
          </label>
        </form>

        <div className="mt-6 flex flex-wrap gap-2.5">
          {categories.map((category) => {
            const isActive = category === activeCategory

            return (
              <button
                key={category}
                type="button"
                onClick={() => onActiveCategoryChange(category)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200 md:text-sm ${
                  isActive
                    ? "border-[rgba(146,232,202,0.88)] bg-[rgba(110,201,173,0.32)] text-[rgba(229,251,244,0.95)] shadow-[0_0_0_1px_rgba(147,230,202,0.24)]"
                    : "border-white/20 bg-white/[0.04] text-[rgba(204,224,218,0.88)] hover:-translate-y-0.5 hover:border-[rgba(174,226,209,0.6)] hover:bg-white/[0.1] hover:text-white"
                }`}
                aria-pressed={isActive}
              >
                {category}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
