export type BlogAuthor = {
  name: string
  role: string
}

export type BlogContentBlock =
  | {
      type: "paragraph"
      text: string
    }
  | {
      type: "heading"
      level: 2 | 3
      text: string
    }
  | {
      type: "list"
      items: string[]
    }
  | {
      type: "callout"
      title: string
      text: string
    }

export type BlogPost = {
  id: string
  slug: string
  title: string
  excerpt: string
  category: string
  date: string
  readTime: string
  author: BlogAuthor
  imageUrl: string
  imageAlt: string
  href: string
  content: BlogContentBlock[]
  isFeatured?: boolean
  isPopular?: boolean
}

export const BLOG_CATEGORIES = [
  "All topics",
  "FinOps strategy",
  "Cost optimization",
  "Engineering",
  "Governance",
  "Leadership",
] as const

const blogPostsData: BlogPost[] = [
  {
    id: "post-01",
    slug: "finops-maturity-roadmap-2026",
    title: "The 90-Day FinOps Maturity Plan for Multi-Cloud Teams",
    excerpt:
      "A tactical roadmap for platform, finance, and engineering leaders to align on unit economics and measurable savings within one quarter.",
    category: "FinOps strategy",
    date: "March 18, 2026",
    readTime: "8 min read",
    author: {
      name: "Priya Menon",
      role: "Head of FinOps",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1600&q=80",
    imageAlt: "Dashboard and planning documents on a conference table",
    href: "/resources/blog/finops-maturity-roadmap-2026",
    content: [
      {
        type: "paragraph",
        text: "FinOps maturity is rarely blocked by tooling first. Teams usually stall because finance, platform, and engineering run on different decision loops. The first 90 days should focus on shared operating cadence before deep optimization.",
      },
      {
        type: "heading",
        level: 2,
        text: "Start with accountability baseline",
      },
      {
        type: "paragraph",
        text: "In the first two weeks, define ownership at service and environment level. Every cost line item should map to a team, a workload, and a decision owner. This turns raw billing data into an action model.",
      },
      {
        type: "list",
        items: [
          "Map top 20 services by monthly spend to accountable owners",
          "Define unit metrics for each service (request, tenant, transaction)",
          "Set weekly variance review with finance and platform engineering",
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Sequence savings by speed and confidence",
      },
      {
        type: "paragraph",
        text: "Fast wins should come from idle waste, storage lifecycle fixes, and rightsizing outliers. Commitments and architecture changes follow once teams establish confidence in baseline demand and forecast reliability.",
      },
      {
        type: "heading",
        level: 3,
        text: "What success looks like by day 90",
      },
      {
        type: "paragraph",
        text: "Mature teams can explain spend variance in plain language, publish a prioritized optimization backlog, and connect cloud economics to roadmap decisions. That is the point where FinOps becomes operating muscle, not a monthly report.",
      },
      {
        type: "callout",
        title: "Executive takeaway",
        text: "If your leadership team cannot explain last month's top variance drivers in one page, focus the next 30 days on ownership mapping and weekly decision cadence before adding more optimization tooling.",
      },
    ],
    isFeatured: true,
    isPopular: true,
  },
  {
    id: "post-02",
    slug: "cloud-commitments-without-waste",
    title: "Using Commitments Without Locking Teams Into Waste",
    excerpt:
      "How top-performing teams combine RIs, Savings Plans, and policy automation to cut baseline cloud spend while preserving delivery speed.",
    category: "Cost optimization",
    date: "March 12, 2026",
    readTime: "6 min read",
    author: {
      name: "Arjun Rao",
      role: "Principal Cloud Economist",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Financial charts on laptop screen",
    href: "/resources/blog/cloud-commitments-without-waste",
    content: [
      {
        type: "paragraph",
        text: "Commitments should reduce baseline cost, not limit product direction. High-performing teams separate predictable workloads from experimental environments before purchasing commitments.",
      },
      {
        type: "heading",
        level: 2,
        text: "Build commitment policy around confidence bands",
      },
      {
        type: "paragraph",
        text: "Use rolling 30, 60, and 90-day demand windows to build confidence ranges. Commit only against stable bands and keep burst capacity on-demand for elasticity.",
      },
      {
        type: "list",
        items: [
          "Separate production baseline from innovation workloads",
          "Track utilization and coverage weekly by service family",
          "Set renewal guardrails tied to product roadmap changes",
        ],
      },
      {
        type: "paragraph",
        text: "When policy and cadence are clear, commitments become a controlled optimization layer instead of a financial gamble.",
      },
    ],
    isPopular: true,
  },
  {
    id: "post-03",
    slug: "engineering-cost-ownership-playbook",
    title: "Engineering Cost Ownership That Actually Works",
    excerpt:
      "A playbook for making cost part of engineering rituals using service-level budgets, weekly variance reviews, and actionable scorecards.",
    category: "Engineering",
    date: "March 08, 2026",
    readTime: "7 min read",
    author: {
      name: "Nina Kapoor",
      role: "Director of Platform",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Modern office building representing enterprise scale",
    href: "/resources/blog/engineering-cost-ownership-playbook",
    content: [
      {
        type: "paragraph",
        text: "Engineering ownership improves when cost signals live where technical work happens. Teams should review cost variance alongside reliability and throughput metrics.",
      },
      {
        type: "heading",
        level: 2,
        text: "Embed cost into delivery rituals",
      },
      {
        type: "list",
        items: [
          "Include service cost trend in sprint planning decks",
          "Add cost impact notes to architecture decision records",
          "Review cost regressions in post-incident retros",
        ],
      },
      {
        type: "paragraph",
        text: "This model avoids blame and keeps focus on unit-economics outcomes aligned with product goals.",
      },
    ],
  },
  {
    id: "post-04",
    slug: "showback-chargeback-governance-model",
    title: "Showback vs Chargeback: Choosing the Right Governance Model",
    excerpt:
      "A practical decision framework to sequence accountability models by organizational maturity and avoid political friction.",
    category: "Governance",
    date: "February 27, 2026",
    readTime: "5 min read",
    author: {
      name: "Ritika Sharma",
      role: "FinOps Governance Lead",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1529078155058-5d716f45d604?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Team working through governance workshop",
    href: "/resources/blog/showback-chargeback-governance-model",
    content: [
      {
        type: "paragraph",
        text: "Governance model choice should follow behavior maturity. Showback builds visibility and trust; chargeback enforces accountability once teams can act on cost insight consistently.",
      },
      {
        type: "heading",
        level: 2,
        text: "Use a phased governance path",
      },
      {
        type: "list",
        items: [
          "Phase 1: Showback with transparent owner reporting",
          "Phase 2: Budget thresholds and escalation workflow",
          "Phase 3: Targeted chargeback for mature domains",
        ],
      },
      {
        type: "paragraph",
        text: "Treat governance as change management. The right sequencing reduces friction and increases adoption.",
      },
    ],
  },
  {
    id: "post-05",
    slug: "forecasting-cloud-spend-for-cfo",
    title: "Forecasting Cloud Spend for CFO Confidence",
    excerpt:
      "Build a forecasting model that connects product roadmap changes to spend trajectories and board-ready scenario planning.",
    category: "Leadership",
    date: "February 20, 2026",
    readTime: "9 min read",
    author: {
      name: "Dev Malhotra",
      role: "VP Finance Systems",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1462899006636-339e08d1844e?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "City skyline at dusk symbolizing business growth",
    href: "/resources/blog/forecasting-cloud-spend-for-cfo",
    content: [
      {
        type: "paragraph",
        text: "Forecast quality improves when finance planning models absorb technical release signals in near real time. Annual budget cycles alone cannot keep up with cloud volatility.",
      },
      {
        type: "heading",
        level: 2,
        text: "Translate roadmap into spend scenarios",
      },
      {
        type: "paragraph",
        text: "Map planned feature releases to expected infrastructure shifts and risk ranges. Keep three forecast views: base, accelerated growth, and efficiency scenario.",
      },
      {
        type: "list",
        items: [
          "Include demand drivers by product surface",
          "Annotate variance with operational events",
          "Publish forecast confidence with monthly review",
        ],
      },
      {
        type: "paragraph",
        text: "This creates a shared planning language for CFOs, product leaders, and engineering managers.",
      },
    ],
  },
  {
    id: "post-06",
    slug: "anomaly-management-control-tower",
    title: "From Alert Noise to Control Tower: Modern Anomaly Operations",
    excerpt:
      "Reduce false positives and shorten response loops with severity routing, owner mapping, and escalation rules tied to business impact.",
    category: "Cost optimization",
    date: "February 14, 2026",
    readTime: "6 min read",
    author: {
      name: "Sagar Iyer",
      role: "Cloud Operations Manager",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1517292987719-0369a794ec0f?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Abstract data center lights and server racks",
    href: "/resources/blog/anomaly-management-control-tower",
    content: [
      {
        type: "paragraph",
        text: "Anomaly programs fail when alerts are disconnected from ownership and response playbooks. Operational maturity requires alert quality and accountability, not just detection sensitivity.",
      },
      {
        type: "heading",
        level: 2,
        text: "Design for actionable escalation",
      },
      {
        type: "list",
        items: [
          "Route alerts by service owner and business impact",
          "Suppress low-confidence noise automatically",
          "Track mean-time-to-triage and resolution quality",
        ],
      },
      {
        type: "paragraph",
        text: "A control-tower model shifts teams from reactive alert chasing to proactive cost reliability operations.",
      },
    ],
  },
  {
    id: "post-07",
    slug: "ai-workload-finops-controls",
    title: "FinOps Controls for AI Workloads Without Slowing Innovation",
    excerpt:
      "Design guardrails for GPU-intensive teams with quota policy, spend limits, and experiment visibility from day one.",
    category: "FinOps strategy",
    date: "February 06, 2026",
    readTime: "7 min read",
    author: {
      name: "Megha Joshi",
      role: "Senior FinOps Architect",
    },
    imageUrl:
      "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=1200&q=80",
    imageAlt: "Close-up technology hardware with neon lighting",
    href: "/resources/blog/ai-workload-finops-controls",
    content: [
      {
        type: "paragraph",
        text: "AI workload economics can escalate quickly when experimentation lacks clear policy boundaries. Teams need lightweight controls that protect budget without slowing iteration.",
      },
      {
        type: "heading",
        level: 2,
        text: "Set policy at the experiment lifecycle level",
      },
      {
        type: "list",
        items: [
          "Enforce default quota and spend ceilings per workspace",
          "Require owner tags and objective tags on all runs",
          "Auto-shutdown idle GPU sessions and stale environments",
        ],
      },
      {
        type: "paragraph",
        text: "When controls are embedded into workflow tooling, innovation teams maintain speed while FinOps retains predictability.",
      },
    ],
  },
]

const featuredPost = blogPostsData.find((post) => post.isFeatured) ?? blogPostsData[0]

if (!featuredPost) {
  throw new Error("Expected at least one blog post in blogPostsData")
}

export const ALL_BLOG_POSTS = blogPostsData
export const FEATURED_BLOG_POST = featuredPost
export const BLOG_POSTS = blogPostsData.filter((post) => !post.isFeatured)

export function getBlogPostBySlug(slug: string) {
  return blogPostsData.find((post) => post.slug === slug)
}

export function getBlogPostById(id: string) {
  return blogPostsData.find((post) => post.id === id)
}

export function getRelatedBlogPosts(currentPost: BlogPost, limit = 3) {
  const sameCategory = blogPostsData.filter(
    (post) => post.id !== currentPost.id && post.category === currentPost.category
  )
  const fallback = blogPostsData.filter(
    (post) => post.id !== currentPost.id && post.category !== currentPost.category
  )

  return [...sameCategory, ...fallback].slice(0, limit)
}

export function getNextBlogPost(currentPost: BlogPost) {
  const currentIndex = blogPostsData.findIndex((post) => post.id === currentPost.id)
  if (currentIndex === -1) return null

  const nextIndex = currentIndex + 1
  return blogPostsData[nextIndex] ?? null
}
