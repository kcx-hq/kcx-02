import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Reveal } from "@/components/motion/Reveal"
import { useMemo, useState } from "react"
import { landingSectionIds } from "@/features/landing/utils/landingSectionIds"

interface FAQItem {
  question: string
  answer: string
}

interface FAQSectionData {
  id: string
  label: string
  items: FAQItem[]
}

const faqSections: FAQSectionData[] = [
  {
    id: "general",
    label: "General",
    items: [
      {
        question: "Do we need perfect tagging before we can start using KCX?",
        answer:
          "No. KCX is designed for real enterprise environments with imperfect tags and ownership metadata, then improves allocation confidence as governance matures.",
      },
      {
        question: "How quickly can finance and platform teams see value?",
        answer:
          "Teams usually see first trusted visibility within days, then expand into optimization, governance scoring, and action workflows in phased milestones.",
      },
    ],
  },
  {
    id: "data-foundation",
    label: "Data Foundation",
    items: [
      {
        question: "How does KCX normalize multi-cloud billing schemas?",
        answer:
          "KCX maps provider-specific line items into a unified cost model so finance and engineering can compare spend, usage, and ownership with one shared vocabulary.",
      },
      {
        question: "Can KCX allocate shared platform and Kubernetes costs?",
        answer:
          "Yes. Shared cost pools can be distributed by policy rules, drivers, and ownership context to provide clearer unit economics and accountability.",
      },
      {
        question: "Can we trace insights back to original billing records?",
        answer:
          "Yes. KCX preserves traceability from decision views to source-level records, so teams can validate recommendations before execution.",
      },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      {
        question: "Can we enforce approvals before optimization actions are executed?",
        answer:
          "Yes. KCX supports governance checkpoints and review workflows so high-impact decisions can be validated by finance and platform owners before rollout.",
      },
      {
        question: "How does KCX support policy-based cost controls?",
        answer:
          "Teams can define guardrails for anomaly severity, budget thresholds, and ownership responsibilities, with action queues prioritized by business impact.",
      },
      {
        question: "Can business owners sign off on allocation and reporting logic?",
        answer:
          "Yes. KCX enables collaborative review loops where finance, FinOps, and business stakeholders align on allocation policy and trust readiness.",
      },
    ],
  },
  {
    id: "security",
    label: "Security",
    items: [
      {
        question: "Does KCX support role-based access by team, account, and environment?",
        answer:
          "Yes. Access can be scoped to organizational structure and operational responsibilities so stakeholders only see the views and actions relevant to their role.",
      },
      {
        question: "How is data protected in transit and at rest?",
        answer:
          "KCX follows enterprise security controls including encrypted transport and encrypted storage patterns aligned with modern cloud security practices.",
      },
      {
        question: "Is there an audit trail for workflow and configuration changes?",
        answer:
          "Yes. KCX tracks important workflow activity and decision lifecycle changes so teams can support compliance, postmortems, and internal governance.",
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    items: [
      {
        question: "Which ecosystem integrations are commonly used with KCX?",
        answer:
          "KCX commonly integrates with cloud billing exports, ownership metadata systems, data platforms, and team workflows used by finance and engineering.",
      },
      {
        question: "Can KCX push findings into our existing ticketing or chat workflows?",
        answer:
          "Yes. Actionable signals can be operationalized through existing collaboration and execution workflows so teams can resolve cost issues faster.",
      },
      {
        question: "Can we export curated data for BI and executive reporting?",
        answer:
          "Yes. KCX supports export-friendly structures for analytics and executive reporting while preserving consistent allocation and governance logic.",
      },
    ],
  },
  {
    id: "pricing",
    label: "Pricing",
    items: [
      {
        question: "How is enterprise pricing structured?",
        answer:
          "Pricing is typically scoped to deployment footprint, operating complexity, and support model so it aligns with enterprise adoption stages.",
      },
      {
        question: "Do you provide pilot options before annual commitment?",
        answer:
          "Yes. Many teams start with a guided pilot that defines success criteria, validates trust, and establishes a production rollout plan.",
      },
    ],
  },
  {
    id: "support",
    label: "Support",
    items: [
      {
        question: "What onboarding model is included for enterprise teams?",
        answer:
          "Onboarding usually includes implementation guidance, stakeholder enablement, and rollout playbooks tailored for finance and platform collaboration.",
      },
      {
        question: "Do we get strategic support after implementation?",
        answer:
          "Yes. KCX includes ongoing success partnership focused on adoption maturity, operating cadence, and measurable cost decision outcomes.",
      },
    ],
  },
]

export function FAQSection() {
  const [activeSectionId, setActiveSectionId] = useState(faqSections[0].id)

  const activeSection = useMemo(
    () => faqSections.find((section) => section.id === activeSectionId) ?? faqSections[0],
    [activeSectionId],
  )

  return (
    <section
      id={landingSectionIds.faq}
      data-header-theme="light"
      className="kcx-section kcx-section-light relative overflow-hidden"
    >
      <div className="kcx-section-mist" />
      <div className="kcx-container relative z-10 w-full">
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2f7f67]">FAQ</p>
          <h2 className="kcx-heading mt-4 text-[1.65rem] font-semibold leading-[1.22] tracking-tight text-[#10231d] sm:text-[2.2rem] md:text-[2.7rem] md:leading-[1.1] lg:text-[3rem]">
            Everything Teams Need Before Rolling Out KCX
          </h2>
        </Reveal>

        <div className="mx-auto mt-8 grid max-w-[1260px] gap-6 sm:mt-10 sm:gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
          <aside className="hidden lg:sticky lg:top-24 lg:block lg:pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3a7866]">Sections</p>
            <div className="mt-3 h-[1.5px] w-[82%] max-w-[180px] rounded-full bg-[linear-gradient(90deg,rgba(63,114,99,0.42)_0%,rgba(63,114,99,0.12)_100%)]" />
            <nav className="mt-5 space-y-1" aria-label="FAQ sections">
              {faqSections.map((section) => {
                const isActive = section.id === activeSectionId
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSectionId(section.id)}
                    className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[15px] font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-[rgba(47,127,103,0.08)] text-[#2f7f67]"
                        : "text-[#3a5248] hover:bg-[rgba(47,127,103,0.04)] hover:text-[#205444]"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
                        isActive ? "bg-[#2f7f67]" : "bg-[rgba(60,123,106,0.3)] group-hover:bg-[#2f7f67]"
                      }`}
                    />
                    <span>{section.label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          <Reveal className="pt-1 md:pt-2" delay={0.06}>
            <div className="lg:hidden -mx-4 rounded-xl border border-[rgba(123,187,167,0.18)] bg-white/60 px-4 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.04)] sm:-mx-6 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3a7866]">Sections</p>
              <div className="relative mt-3">
                <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-[linear-gradient(90deg,rgba(255,255,255,0.8)_0%,rgba(255,255,255,0)_100%)]" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-[linear-gradient(270deg,rgba(255,255,255,0.8)_0%,rgba(255,255,255,0)_100%)]" />
                <div
                  className="flex items-center gap-2 overflow-x-auto pb-2 pr-6 snap-x snap-mandatory border-b border-[rgba(123,187,167,0.18)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  style={{ WebkitOverflowScrolling: "touch" }}
                  aria-label="FAQ sections"
                >
                  {faqSections.map((section) => {
                    const isActive = section.id === activeSectionId
                    return (
                      <button
                        key={`line-${section.id}`}
                        type="button"
                        onClick={() => setActiveSectionId(section.id)}
                        className={`snap-start whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
                          isActive
                            ? "text-[#2f7f67] bg-[rgba(47,127,103,0.1)]"
                            : "text-[#3a5248] hover:text-[#2f7f67]"
                        }`}
                      >
                        {section.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mb-2 mt-5 lg:mt-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2f7f67]">{activeSection.label}</p>
            </div>

            <Accordion type="single" collapsible className="w-full px-0 py-1 sm:px-0">
              {activeSection.items.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`faq-${activeSection.id}-${index}`}
                  className="border-b border-[rgba(123,187,167,0.18)] last:border-b-0"
                >
                  <AccordionTrigger className="group py-5 text-left text-[14px] font-semibold leading-[1.5] text-[#122720] transition-colors hover:text-[#2f7f68] [&>svg]:hidden sm:text-[15px] sm:leading-[1.6] md:text-[1.05rem]">
                    <span className="flex w-full items-center justify-between gap-4 sm:gap-6">
                      <span>{faq.question}</span>
                      <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[rgba(118,180,160,0.4)] text-[#4f7268] transition-all duration-200 group-data-[state=open]:border-[rgba(46,160,130,0.5)] group-data-[state=open]:bg-[rgba(46,160,130,0.08)] group-data-[state=open]:text-[#1f6c58] sm:h-8 sm:w-8">
                        <span className="absolute h-[1.5px] w-3 rounded-full bg-current" />
                        <span className="absolute h-3 w-[1.5px] rounded-full bg-current transition-all duration-200 group-data-[state=open]:scale-y-0 group-data-[state=open]:opacity-0" />
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="max-w-4xl pb-5 text-[13px] leading-[1.7] text-[#4a6259] sm:text-[15px] sm:leading-[1.75] md:text-[15px]">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
