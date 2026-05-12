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
    id: "onboarding",
    label: "Onboarding",
    items: [
      {
        question: "What onboarding paths does KCX support?",
        answer:
          "KCX supports three onboarding paths: file upload, S3 import, and guided AWS connection. Teams can start with the path that fits their current billing environment and expand over time.",
      },
      {
        question: "How quickly can teams become operational?",
        answer:
          "Most teams can move from onboarding to first validated views quickly, then phase into budgets, anomaly workflows, and optimization operations as governance is aligned.",
      },
    ],
  },
  {
    id: "data-readiness",
    label: "Data Readiness",
    items: [
      {
        question: "Can KCX work with messy or incomplete billing data?",
        answer:
          "Yes. KCX is designed for real-world billing quality. It validates ingestion quality, normalizes what is available, and helps teams improve confidence over time rather than requiring perfect data on day one.",
      },
      {
        question: "What does data readiness mean inside KCX?",
        answer:
          "Data readiness means billing inputs are validated and normalized into warehouse-backed structures that support dashboards, budgets, anomalies, and optimization workflows.",
      },
      {
        question: "How does KCX support analytics confidence?",
        answer:
          "KCX preserves a structured path from ingestion through normalized analytics, so finance and platform teams can investigate spend changes with clearer traceability and fewer ad hoc data disputes.",
      },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    items: [
      {
        question: "How does KCX handle governance for optimization and actions?",
        answer:
          "KCX is built for governed operations. Teams can review recommendations, align ownership, and execute selected actions with visibility into status and accountability.",
      },
      {
        question: "Can we control who can view data and execute actions?",
        answer:
          "Yes. KCX supports role-aligned access patterns so organizations can separate visibility, investigation, and execution permissions across finance, FinOps, and platform stakeholders.",
      },
      {
        question: "Does KCX provide a roadmap-safe execution model?",
        answer:
          "Yes. Execution today is intentionally scoped to selected AWS actions. KCX emphasizes controlled, high-confidence workflows over broad automation claims that outpace governance readiness.",
      },
    ],
  },
  {
    id: "analytics-optimization",
    label: "Analytics & Optimization",
    items: [
      {
        question: "Which signals can teams operationalize in KCX?",
        answer:
          "Teams can operationalize warehouse-backed dashboards, budgets, anomaly detection, and optimization recommendations including rightsizing, idle, and commitment opportunities.",
      },
      {
        question: "What is the scope of AWS execution inside KCX?",
        answer:
          "KCX supports selected AWS execution paths tied to vetted recommendations. This keeps action workflows practical and controlled while retaining clear governance context.",
      },
      {
        question: "Can teams investigate anomalies without switching tools?",
        answer:
          "Yes. KCX brings ingestion context, validated analytics, anomalies, and recommendation workflows into one workspace so teams can move from detection to action more efficiently.",
      },
    ],
  },
  {
    id: "trust-adoption",
    label: "Trust & Adoption",
    items: [
      {
        question: "Is KCX suitable for enterprise access-control requirements?",
        answer:
          "KCX is designed for enterprise collaboration models where finance, engineering, and cloud operations need scoped access, validated workflows, and shared decision context.",
      },
      {
        question: "How should teams think about roadmap and adoption expectations?",
        answer:
          "KCX focuses on operational depth over over-promising breadth. Teams typically start with validated onboarding and trusted intelligence, then expand optimization and selected AWS action workflows as readiness increases.",
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
                    className={`group flex w-full items-center gap-2.5 rounded-none px-2.5 py-2 text-left text-[15px] font-medium transition-all duration-200 ${
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
            <div className="lg:hidden -mx-4 rounded-none border border-[rgba(123,187,167,0.18)] bg-white/60 px-4 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.04)] sm:-mx-6 sm:px-6">
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
                        className={`snap-start whitespace-nowrap rounded-none px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
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
                      <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-none border border-[rgba(118,180,160,0.4)] text-[#4f7268] transition-all duration-200 group-data-[state=open]:border-[rgba(46,160,130,0.5)] group-data-[state=open]:bg-[rgba(46,160,130,0.08)] group-data-[state=open]:text-[#1f6c58] sm:h-8 sm:w-8">
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

