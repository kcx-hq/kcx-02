import { ArrowRight, ArrowUpRight, Building2 } from "lucide-react"

import { AuroraBackground } from "@/components/brand/AuroraBackground"
import { PageFooter } from "@/components/layout/PageFooter"

type FeaturedLeader = {
  name: string
  title: string
  image: string
  bio: string[]
  quote: string
  linkedin: string
}

type LeaderProfile = {
  name: string
  title: string
  image: string
  credibility: string
  supportingLine?: string
  linkedin: string
}


type Principle = {
  title: string
  description: string
}

const FEATURED_LEADER: FeaturedLeader = {
  name: "Avery Patel",
  title: "Co-Founder & Chief Executive Officer",
  image:
    "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1100&q=80",
  bio: [
    "Avery has spent over 15 years at the intersection of cloud engineering and enterprise finance, leading cloud cost transformation programs across high-growth SaaS organizations.",
    "At KCX, Avery works directly with CFO and platform leadership teams to build operating models that improve margin confidence without slowing product velocity.",
  ],
  quote:
    "FinOps only works when finance, engineering, and leadership can act from the same operational truth.",
  linkedin: "#",
}

const LEADERSHIP_TEAM: LeaderProfile[] = [
  {
    name: "Jordan Kim",
    title: "Chief Product Officer",
    image:
      "https://images.unsplash.com/photo-1573497019236-17f8177b81e8?auto=format&fit=crop&w=900&q=80",
    credibility:
      "Former VP Product at a multi-cloud observability platform serving Fortune 500 engineering teams.",
    supportingLine:
      "Leads KCX roadmap across allocation, forecasting, and governance workflows for finance and platform operators.",
    linkedin: "#",
  },
  {
    name: "Riley Morgan",
    title: "Chief Technology Officer",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=80",
    credibility:
      "Scaled distributed systems handling billions of daily cost and usage events across AWS, Azure, and GCP.",
    supportingLine:
      "Owns platform reliability, data integrity, and security architecture for mission-critical FinOps decisions.",
    linkedin: "#",
  },
  {
    name: "Taylor Singh",
    title: "Chief Financial Strategy Officer",
    image:
      "https://images.unsplash.com/photo-1551836022-4c4c79ecde51?auto=format&fit=crop&w=900&q=80",
    credibility:
      "Previously led FP&A and cloud economics for two global SaaS businesses through hypergrowth stages.",
    supportingLine:
      "Partners with enterprise finance teams on KPI design, unit economics, and board-level spend narratives.",
    linkedin: "#",
  },
  {
    name: "Casey Rivera",
    title: "SVP, Customer Outcomes",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
    credibility:
      "Built strategic success programs that delivered measurable cloud savings across 200+ enterprise accounts.",
    supportingLine:
      "Leads advisory engagements focused on adoption, spend accountability, and operating rhythm maturity.",
    linkedin: "#",
  },
  {
    name: "Morgan Lee",
    title: "SVP, Strategic Partnerships",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
    credibility:
      "Negotiated and scaled ecosystem partnerships across cloud providers, MSPs, and enterprise data platforms.",
    supportingLine:
      "Expands KCX integration depth to support real procurement, governance, and optimization workflows.",
    linkedin: "#",
  },
  {
    name: "Devika Nair",
    title: "VP, Platform Operations",
    image:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=900&q=80",
    credibility:
      "Former platform leader responsible for global cost visibility across 1,200+ cloud workloads.",
    supportingLine:
      "Drives internal operating discipline and cross-functional execution standards inside KCX.",
    linkedin: "#",
  },
]




const PRINCIPLES: Principle[] = [
  {
    title: "Build for operators",
    description:
      "We design for the teams accountable for outcomes, not vanity dashboards. Every workflow is grounded in day-to-day execution.",
  },
  {
    title: "Accountability over guesswork",
    description:
      "We create shared visibility so owners can move from assumptions to measurable action, faster and with less friction.",
  },
  {
    title: "Clarity at scale",
    description:
      "As organizations grow, financial control should become sharper, not slower. Our leadership prioritizes durable operating systems.",
  },
]

function LeadershipHero() {
  return (
    <section
      data-header-theme="dark"
      className="relative isolate overflow-hidden border-b border-white/10 bg-[#07111c] pb-16 pt-32 text-white md:pb-20 md:pt-36"
    >
      <div className="absolute inset-0 opacity-70">
        <AuroraBackground />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,12,18,0.86)_0%,rgba(7,14,20,0.76)_45%,rgba(8,16,23,0.93)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(56%_40%_at_78%_20%,rgba(102,210,179,0.12),transparent_72%),radial-gradient(36%_28%_at_18%_24%,rgba(75,128,210,0.1),transparent_74%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 md:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(148,224,198,0.92)]">
          About / Leadership
        </p>

        <h1 className="mt-4 max-w-4xl text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
          Leadership built on real FinOps experience
        </h1>

        <p className="mt-5 max-w-3xl text-base leading-7 text-[rgba(214,230,226,0.88)] md:text-lg">
          Meet the team guiding KCX across product innovation, customer impact, and responsible growth.
        </p>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-[rgba(200,220,215,0.84)] md:text-base">
          Our leadership team includes former cloud operators, finance executives, and product builders trusted by
          enterprise teams managing complex multi-cloud environments.
        </p>
      </div>
    </section>
  )
}

function FeaturedLeaderSection() {
  return (
    <section aria-labelledby="featured-leader-title" className="rounded-2xl border border-border-light bg-white p-5 shadow-sm md:p-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,0.74fr)_minmax(0,1fr)] md:items-center md:gap-6">
        <div className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-xl border border-border-light bg-[linear-gradient(160deg,#e8ece9_0%,#dde4e1_100%)] md:mx-0 md:max-w-[340px]">
          <img
            src={FEATURED_LEADER.image}
            alt={`Portrait of ${FEATURED_LEADER.name}, ${FEATURED_LEADER.title}`}
            className="h-full w-full max-h-[320px] object-cover object-center [aspect-ratio:5/6] md:max-h-[340px] md:[aspect-ratio:4/5]"
            loading="lazy"
          />
        </div>

        <article>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f7f68]">Featured leader</p>
          <h2 id="featured-leader-title" className="mt-2 text-xl font-semibold tracking-tight text-text-primary md:text-2xl">
            {FEATURED_LEADER.name}
          </h2>
          <p className="mt-1.5 text-sm font-medium text-[#2f7f68]">{FEATURED_LEADER.title}</p>

          <div className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
            {FEATURED_LEADER.bio.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <blockquote className="mt-4 border-l-2 border-[#4d9d88] bg-highlight-green px-3.5 py-2.5 text-sm leading-6 text-text-primary">
            {FEATURED_LEADER.quote}
          </blockquote>

          <a
            href={FEATURED_LEADER.linkedin}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2f7f68] transition hover:text-[#256855] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            View LinkedIn profile
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </article>
      </div>
    </section>
  )
}

function TeamGridSection() {
  return (
    <section aria-labelledby="leadership-team-title">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f7f68]">Executive team</p>
          <h2 id="leadership-team-title" className="mt-2 text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
            Leadership across product, platform, and outcomes
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-7 text-text-secondary md:text-base">
          A cross-functional team with deep operating experience in scaling SaaS, multi-cloud governance, and
          enterprise financial discipline.
        </p>
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {LEADERSHIP_TEAM.map((leader) => (
          <article
            key={leader.name}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-border-light bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(9,20,30,0.12)]"
          >
            <div className="relative h-56 overflow-hidden border-b border-border-light bg-[linear-gradient(160deg,#e7ece9_0%,#dae3df_100%)]">
              <img
                src={leader.image}
                alt={`Portrait of ${leader.name}, ${leader.title}`}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                loading="lazy"
              />
            </div>

            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-lg font-semibold text-text-primary">{leader.name}</h3>
              <p className="mt-1 text-sm font-medium text-[#2f7f68]">{leader.title}</p>
              <p className="mt-4 text-sm leading-6 text-text-secondary">{leader.credibility}</p>
              {leader.supportingLine ? <p className="mt-3 text-sm leading-6 text-text-secondary">{leader.supportingLine}</p> : null}

              <a
                href={leader.linkedin}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2f7f68] transition hover:text-[#256855] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                LinkedIn
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function WhyWeBuiltSection() {
  return (
    <section aria-labelledby="why-kcx-title" className="rounded-2xl border border-border-light bg-bg-surface p-6 md:p-8">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)] md:gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f7f68]">Our perspective</p>
          <h2 id="why-kcx-title" className="mt-2 text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
            Why we built KCX
          </h2>
          <p className="mt-4 text-sm leading-7 text-text-secondary md:text-base">
            We built KCX after seeing how often finance and engineering teams were expected to control cloud spend with
            fragmented tooling, delayed reporting, and unclear ownership. The result was slow decisions and recurring
            surprises.
          </p>
          <p className="mt-4 text-sm leading-7 text-text-secondary md:text-base">
            Our team believes FinOps should feel operational, not theoretical. KCX helps teams align accountability,
            move faster on high-confidence actions, and scale cloud economics as a strategic advantage.
          </p>
        </div>

        <aside className="rounded-xl border border-[rgba(62,138,118,0.34)] bg-highlight-green/80 p-5 md:p-6" aria-label="Leadership beliefs">
          <p className="text-sm font-semibold text-text-primary">What we optimize for</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-text-secondary">
            <li className="flex items-start gap-2.5">
              <Building2 className="mt-0.5 h-4 w-4 text-[#2f7f68]" aria-hidden="true" />
              <span>Operating models that finance and engineering teams can adopt without friction.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Building2 className="mt-0.5 h-4 w-4 text-[#2f7f68]" aria-hidden="true" />
              <span>Decision systems that hold up under scale, reorgs, and changing business priorities.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Building2 className="mt-0.5 h-4 w-4 text-[#2f7f68]" aria-hidden="true" />
              <span>Long-term trust through transparent metrics and measurable financial outcomes.</span>
            </li>
          </ul>
        </aside>
      </div>
    </section>
  )
}


function PrinciplesSection() {
  return (
    <section aria-labelledby="leadership-principles-title">
      <h2 id="leadership-principles-title" className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
        Leadership principles
      </h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PRINCIPLES.map((principle) => (
          <article key={principle.title} className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-text-primary">{principle.title}</h3>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{principle.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function FinalCtaSection() {
  return (
    <section
      aria-labelledby="leadership-cta-title"
      className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.14)] bg-[linear-gradient(135deg,#081522_0%,#0b1f30_56%,#0a1928_100%)] p-7 text-white md:p-9"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(56%_72%_at_82%_18%,rgba(102,210,179,0.15),transparent_72%),radial-gradient(42%_52%_at_20%_86%,rgba(75,128,210,0.12),transparent_74%)]" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(158,224,201,0.94)]">Partner with KCX leadership</p>
        <h2 id="leadership-cta-title" className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight md:text-3xl">
          Bring executive clarity to your cloud economics strategy
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[rgba(218,233,229,0.88)] md:text-base">
          Connect with our team to discuss your FinOps operating model, decision gaps, and opportunities to improve
          accountability at scale.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#3e8a76] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#357563] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Talk to our team
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <a
            href="#"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/25 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  )
}

export function LeadershipPage() {
  return (
    <>
      <LeadershipHero />

      <main data-header-theme="light" className="bg-[linear-gradient(180deg,#f2f3f2_0%,#f5f7f6_34%,#f1f5f3_100%)] py-14 md:py-18">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-6 md:space-y-9 md:px-10">
          <FeaturedLeaderSection />
          <TeamGridSection />
          <WhyWeBuiltSection />
          <PrinciplesSection />
          <FinalCtaSection />
        </div>
      </main>

      <PageFooter />
    </>
  )
}
