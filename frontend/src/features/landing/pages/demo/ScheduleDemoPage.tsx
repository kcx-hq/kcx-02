import kcxLogo from "@/assets/logos/kcx-logo.svg"
import { SplitHeroLeftPanel } from "@/features/landing/components/SplitHeroLeftPanel"
import { DemoRequestForm } from "@/features/landing/pages/demo/components/DemoRequestForm"

export function ScheduleDemoPage() {
  return (
    <section className="w-full min-h-[100svh] lg:h-[100svh] lg:overflow-hidden">
      <div className="grid min-h-[100svh] lg:h-[100svh] lg:grid-cols-[3fr_2fr]">
        {/* Left panel (dark, minimal) */}
        <SplitHeroLeftPanel className="px-6 py-12 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-[40rem]">
            <div className="flex items-center gap-3">
              <img src={kcxLogo} alt="KCX" className="h-8 w-auto" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(214,230,226,0.75)]">
                Schedule demo
              </span>
            </div>

            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[rgba(170,225,207,0.88)]">
              Cloud cost clarity
            </p>
            <h1 className="kcx-heading mt-3 text-balance text-[2rem] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[2.35rem]">
              Turn cloud billing into actionable savings.
            </h1>
            <p className="mt-4 max-w-[58ch] text-sm leading-7 text-[rgba(214,230,226,0.78)]">
              A short walkthrough of how KCX helps teams find waste, detect anomalies, and build repeatable FinOps
              operating habits.
            </p>
          </div>
        </SplitHeroLeftPanel>

        {/* Right panel (light form) */}
        <main className="flex items-start bg-[#f6faf8] px-6 py-12 text-[#0F1F1A] sm:px-10 lg:h-[100svh] lg:overflow-auto lg:px-12 lg:py-16">
          <div className="mx-auto w-full max-w-[30rem]">
            <DemoRequestForm tone="light" chrome="none" />
          </div>
        </main>
      </div>
    </section>
  )
}
