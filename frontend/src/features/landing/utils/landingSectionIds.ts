export const landingSectionIds = {
  hero: "hero",
  integrations: "integrations",
  transformation: "transformation",
  works: "how-kcx-works",
  faq: "faq",
  enterpriseCta: "enterprise-cta",
} as const

export type LandingSectionId = (typeof landingSectionIds)[keyof typeof landingSectionIds]

