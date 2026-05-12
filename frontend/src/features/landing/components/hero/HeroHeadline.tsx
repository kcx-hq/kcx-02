import { Button } from "@/components/ui/button"
import { RotatingCloudText } from "@/features/landing/components/hero/RotatingCloudText"
import { landingCloudProviders, landingHeroHighlights } from "@/features/landing/data/heroCopy"
import { handleAppLinkClick } from "@/lib/navigation"
import { cn } from "@/lib/utils"

type HeroHeadlineProps = {
  className?: string
}

export function HeroHeadline({ className }: HeroHeadlineProps) {
  return (
    <div className={cn("max-w-[60rem] text-center", className)}>
      <div className="inline-flex items-center rounded-none border border-white/[0.12] bg-white/[0.06] px-5 py-2 backdrop-blur-md">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
          Cloud FinOps Platform
        </span>
      </div>

      <h1 className="kcx-heading mt-6 text-balance text-[2rem] font-semibold tracking-[-0.03em] sm:text-[2.75rem] lg:text-[4.1rem] lg:leading-[1.06]">
        <span className="block text-white [text-shadow:0_8px_20px_rgba(4,12,18,0.4)]">
          Turn Cloud Billing Data
        </span>
        <span className="mt-1 block lg:mt-1.5">
          <span className="text-white/90"> Into </span>
          <span className="bg-[linear-gradient(180deg,#9ee8d1_0%,#72d0b4_46%,#4fa58f_100%)] bg-clip-text text-transparent [text-shadow:0_0_22px_rgba(95,196,167,0.35)]">
            {" "}
            FinOps Action{" "}
          </span>
          <span className="text-white/90"> Across </span>
        </span>
        <span className="mt-1 block lg:mt-1.5">
          <span className="bg-[linear-gradient(180deg,#8ce4c8_0%,#4fa58f_100%)] bg-clip-text text-transparent [text-shadow:none]">
            <RotatingCloudText
              items={landingCloudProviders}
              className="min-w-[5.2ch]"
              textClassName="bg-[linear-gradient(180deg,#9ee8d1_0%,#72d0b4_46%,#4fa58f_100%)] bg-clip-text text-transparent [text-shadow:0_0_24px_rgba(95,196,167,0.45),0_10px_26px_rgba(4,10,18,0.5)]"
            />
          </span>
        </span>
      </h1>

      <p className="mx-auto mt-6 max-w-[46rem] text-[0.95rem] leading-[1.7] text-[rgba(220,232,228,0.72)] sm:text-[1.08rem] sm:leading-[1.75]">
        KCX helps finance, engineering, and cloud teams move from billing ingestion to trusted
        cost intelligence, surfacing budgets, anomalies, and optimization opportunities, with
        selected AWS actions executed from the same operational workspace.
      </p>

 

      <div className="mx-auto mt-7 flex max-w-[56rem] flex-wrap items-center justify-center gap-2.5">
        {landingHeroHighlights.map((item) => (
          <div
            key={item.label}
            className="inline-flex items-center gap-2 rounded-none border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[0.85rem] text-white/80 backdrop-blur-sm sm:text-[0.9rem]"
          >
            <item.icon className="h-3.5 w-3.5 text-[#6ec4ab]" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-9 flex items-center justify-center">
        <Button
          asChild
          className="h-[3.25rem] !rounded-none [border-radius:0!important] bg-brand-primary px-8 text-[0.95rem] font-semibold text-white shadow-[0_20px_40px_-20px_rgba(31,128,104,0.7),inset_0_1px_0_rgba(255,255,255,0.14)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-primary-hover hover:shadow-[0_26px_48px_-20px_rgba(31,128,104,0.85)] focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09121a] sm:h-[3.5rem] sm:px-9 sm:text-[1rem]"
          >
            <a
              href="/schedule-demo"
              onClick={(event) => handleAppLinkClick(event, "/schedule-demo")}
            >
              Schedule a Demo
            </a>
        </Button>
      </div>

      <p className="mx-auto mt-3 max-w-[37rem] text-[0.82rem] leading-[1.7] text-[rgba(194,216,208,0.68)] sm:text-[0.9rem]">
        See how KCX takes teams from onboarding to optimization action.
      </p>

     
    </div>
  )
}

