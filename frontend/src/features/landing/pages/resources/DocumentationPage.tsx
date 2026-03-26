import { PageFooter } from "@/components/layout/PageFooter"
import { PageHero } from "@/components/layout/PageHero"

const DOC_SECTIONS = [
  {
    id: "getting-started",
    title: "Getting Started",
    body: "Start with account setup, workspace creation, and initial cloud source connection. This placeholder section can later map to your real quickstart flow.",
  },
  {
    id: "installation",
    title: "Installation",
    body: "Installation docs placeholder for agents, API keys, and provider configuration. Add environment-specific steps for development and production.",
  },
  {
    id: "features",
    title: "Features",
    body: "Overview placeholder for cost explorer, anomaly detection, recommendations, and policy guardrails with links to deeper docs pages.",
  },
  {
    id: "api-integrations",
    title: "API / Integrations",
    body: "Reference placeholder for endpoints, webhooks, and provider integrations. Include auth details, request examples, and rate limits when ready.",
  },
  {
    id: "faq",
    title: "FAQ",
    body: "Frequently asked questions placeholder covering billing alignment, user roles, permissions, and common onboarding issues.",
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    body: "Troubleshooting placeholder for sync delays, missing cost tags, and API errors. Add known issues and diagnostics checklist.",
  },
]

export function DocumentationPage() {
  return (
    <>
      <PageHero
        eyebrow="Resources / Documentation"
        title="Documentation"
        description="Guides for setup, integrations, and day-to-day platform usage in one structured reference."
      />

      <section data-header-theme="light" className="bg-bg-main py-12 md:py-16">
        <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
          <div className="rounded-xl border border-border-light bg-bg-surface p-4 md:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">On This Page</p>
            <nav aria-label="Documentation index" className="mt-3 flex flex-wrap gap-2">
              {DOC_SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-md border border-border-light bg-white px-3 py-1.5 text-sm text-text-secondary hover:border-[rgba(62,138,118,0.35)] hover:text-text-primary"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>

          <div className="mt-6 grid gap-7 md:mt-0 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr]">
            <aside className="hidden md:block">
              <div className="sticky top-28 rounded-xl border border-border-light bg-bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">Section Index</p>
                <nav aria-label="Documentation sections" className="mt-3 space-y-1.5">
                  {DOC_SECTIONS.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="block rounded-md px-2.5 py-1.5 text-sm text-text-secondary transition-colors hover:bg-highlight-green hover:text-text-primary"
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>

            <div className="space-y-4">
              {DOC_SECTIONS.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-28 rounded-xl border border-border-light bg-bg-surface p-6 md:p-7"
                  aria-labelledby={`${section.id}-heading`}
                >
                  <h2
                    id={`${section.id}-heading`}
                    className="text-xl font-semibold tracking-tight text-text-primary md:text-2xl"
                  >
                    {section.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-text-secondary md:text-base">{section.body}</p>
                  <div className="mt-5 rounded-lg border border-dashed border-border-light bg-white/80 p-4 text-sm text-text-muted">
                    Placeholder content block for detailed guides, snippets, and examples.
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PageFooter />
    </>
  )
}
