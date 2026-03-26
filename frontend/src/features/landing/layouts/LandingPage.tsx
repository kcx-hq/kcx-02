import "@/features/landing/styles/landing.css"

import { PageFooter } from "@/components/layout/PageFooter"
import { useScrollToHash } from "@/features/landing/hooks/useScrollToHash"
import { EnterpriseCTA } from "@/features/landing/sections/EnterpriseCTA"
import { FAQSection } from "@/features/landing/sections/FAQSection"
import { Hero } from "@/features/landing/sections/Hero"
import { HowKCXWorks } from "@/features/landing/sections/HowKCXWorks"
import { IntegrationsMarquee } from "@/features/landing/sections/IntegrationsMarquee"
import { ProblemSolutionTransform } from "@/features/landing/sections/ProblemSolutionTransform"

export function LandingPage() {
  useScrollToHash()

  return (
    <div className="kcx-page-shell" data-feature="landing">
      <Hero />
      <IntegrationsMarquee />
      <ProblemSolutionTransform />
      <HowKCXWorks />
      <FAQSection />
      <EnterpriseCTA />
      <PageFooter />
    </div>
  )
}
