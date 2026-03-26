import { ArrowRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { Compass, Flag } from "lucide-react";
import { Layers3 } from "lucide-react";
import { AuroraBackground } from "@/components/brand/AuroraBackground";
import { PageFooter } from "@/components/layout/PageFooter";
import { ShieldCheck, Users, TrendingUp } from "lucide-react";

type ChapterShellProps = {
  id?: string;
  title?: string;
  titleClassName?: string;
  className?: string;
  chipLabel?: string;
  chipAlign?: "left" | "center";
  chipTone?: "light" | "dark";
  children: ReactNode;
};

const TRANSFORMATION_STEPS = [
  "Decisions happen before overspend",
  "Ownership becomes clear",
  "Cost becomes part of daily operations",
] as const;
const TRANSFORMATION_NOTES = [
  "Move visibility upstream.",
  "Translate insight into ownership.",
  "Turn ownership into daily operating behavior.",
] as const;

const VALUES = [
  "Clarity over complexity",
  "Ownership by design",
  "Built for collaboration",
  "Measured improvement",
] as const;
const VALUE_SUPPORT: Record<(typeof VALUES)[number], string> = {
  "Clarity over complexity":
    "Make the decision path visible before adding more tooling.",
  "Ownership by design":
    "Assign accountability early, where decisions and tradeoffs are made.",
  "Built for collaboration":
    "Finance, engineering, and leadership work from shared context.",
  "Measured improvement":
    "Progress is continuous, observable, and tied to operating outcomes.",
};

function StoryContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-6 md:px-10 ${className}`}>
      {children}
    </div>
  );
}

function SectionChip({
  label,
  align = "center",
  tone = "light",
}: {
  label: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
}) {
  return (
    <div className={align === "center" ? "mb-5 flex justify-center" : "mb-5"}>
      <span
        className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
          tone === "dark"
            ? "border-[rgba(99,209,175,0.4)] bg-[rgba(62,138,118,0.18)] text-[rgba(170,225,207,0.95)]"
            : "border-[rgba(62,138,118,0.28)] bg-[rgba(62,138,118,0.08)] text-[#3E8A76]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function ChapterShell({
  id,
  title,
  titleClassName = "",
  className = "",
  chipLabel,
  chipAlign = "center",
  chipTone = "light",
  children,
}: ChapterShellProps) {
  return (
    <section id={id} className={className}>
      <StoryContainer className="max-w-5xl">
        {chipLabel ? (
          <SectionChip label={chipLabel} align={chipAlign} tone={chipTone} />
        ) : null}
        {title ? (
          <h2
            className={`max-w-4xl text-[1.5rem] font-semibold tracking-[-0.025em] text-[#0F1F1A] sm:text-[1.8rem] md:text-[1.95rem] md:leading-[1.16] ${titleClassName}`}
          >
            {title}
          </h2>
        ) : null}
        {children}
      </StoryContainer>
    </section>
  );
}

function StoryHero() {
  return (
    <section
      data-header-theme="dark"
      className="relative isolate overflow-hidden border-b border-white/10 bg-[#06101a] pb-12 pt-20 text-white md:pb-14 md:pt-24"
    >
      <div className="absolute inset-0 opacity-70">
        <AuroraBackground />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,12,18,0.82)_0%,rgba(7,14,20,0.76)_48%,rgba(8,16,23,0.94)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(62%_48%_at_78%_18%,rgba(102,210,179,0.14),transparent_72%),radial-gradient(42%_32%_at_14%_20%,rgba(89,144,224,0.14),transparent_72%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:68px_68px]" />

      <StoryContainer className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:items-start">
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(151,228,203,0.92)]">
            ABOUT / OUR STORY
          </p>
          <h1 className="mt-5 max-w-4xl text-[2.15rem] font-semibold leading-[1.03] tracking-[-0.04em] text-white sm:text-[2.7rem] md:text-[3.55rem] md:leading-[1.01]">
            <span className="block">Cloud costs grew.</span>
            <span className="block">Clarity didn’t.</span>
          </h1>
          <p className="mt-6 max-w-[60ch] text-[15px] leading-7 text-[rgba(214,230,226,0.88)] md:text-[17px] md:leading-8">
            KCX was built to bring clarity, accountability, and control back to
            cloud spend.
          </p>
          <p className="mt-3 max-w-[66ch] text-sm leading-7 text-[rgba(200,220,215,0.84)] md:text-base md:leading-7">
            As teams scaled, ownership blurred, decisions slowed, and costs
            became reactive instead of intentional.
          </p>
        </div>

        
      </StoryContainer>
    </section>
  );
}

function TensionSection() {
  return (
    <section
      id="tension"
      className="min-h-screen flex flex-col justify-center py-16 md:py-20"
    >
      <StoryContainer className="max-w-5xl flex flex-col items-center">
        <SectionChip label="Problem" align="center" />
        <div className="max-w-3xl text-center">
          <h2 className="text-[1.7rem] font-semibold tracking-tight text-[#0F1F1A] md:text-[2.2rem] md:leading-[1.2]">
            The problem wasn&apos;t lack of data - it was lack of ownership.
          </h2>
          <p className="mt-4 max-w-[62ch] text-sm leading-7 text-[#445A53] md:text-[0.98rem] md:leading-8">
            Every team had part of the picture, but no shared operating model
            for decisions.
          </p>
        </div>

        <div className="relative mt-10 rounded-3xl border border-[#D9E5E1] bg-[#F9FCFB] p-3 shadow-[0_12px_32px_-22px_rgba(21,37,49,0.22)] md:p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-2xl border border-[#D9E5E1] bg-white p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A8078]">
                Finance
              </p>
              <p className="mt-3 text-[1rem] font-semibold leading-7 tracking-tight text-[#0F1F1A]">
                Finance saw the numbers, but not the systems.
              </p>
            </article>

            <article className="rounded-[1.4rem] border border-[rgba(16,30,43,0.18)] bg-[linear-gradient(180deg,#0d1f2d_0%,#122b3d_100%)] p-6 text-white shadow-[0_16px_30px_rgba(8,18,31,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(170,225,207,0.9)]">
                Engineering
              </p>
              <p className="mt-3 text-[1rem] leading-7 text-[rgba(232,241,239,0.94)]">
                Engineering owned the systems, but not the cost.
              </p>
            </article>

            <article className="rounded-2xl border border-[#D9E5E1] bg-white p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A8078]">
                Leadership
              </p>
              <p className="mt-3 text-[1rem] font-semibold leading-7 tracking-tight text-[#0F1F1A]">
                Leadership saw the impact - but too late.
              </p>
            </article>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm leading-7 text-[#445A53] md:text-[0.98rem] md:leading-8">
            Cloud spend didn&apos;t break because of missing tools.
          </p>
          <p className="mt-2 text-[1.35rem] font-semibold tracking-tight text-[#0F1F1A] md:text-[1.75rem] md:leading-[1.3]">
            It broke because no one truly owned it.
          </p>
        </div>
      </StoryContainer>
    </section>
  );
}

function InsightSection() {
  return (
    <section
      id="realization"
      className="relative overflow-hidden border-y border-[rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,#081521_0%,#0C1E2D_100%)] py-14 text-white md:py-16"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(52%_46%_at_78%_18%,rgba(99,209,175,0.14),transparent_74%),radial-gradient(38%_32%_at_12%_84%,rgba(91,146,224,0.12),transparent_72%)]" />
      <StoryContainer className="relative max-w-5xl">
        <div className="grid gap-6 md:grid-cols-[0.95fr_1.05fr] md:items-end">
          <div className="border-l-[3px] border-[rgba(99,209,175,0.62)] pl-4 md:pl-5">
            <h2 className="max-w-[14ch] text-[1.7rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white md:text-[2.2rem]">
              Cloud cost is not a reporting problem.
            </h2>
          </div>

          <div className="rounded-[22px] border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] px-5 py-5 shadow-[0_18px_42px_-26px_rgba(2,8,14,0.68)] md:px-6">
            <p className="text-[1.25rem] font-semibold leading-[1.18] tracking-[-0.02em] text-[rgba(170,225,207,0.96)] md:text-[1.55rem]">
              It&apos;s an operating problem.
            </p>
            <p className="mt-2.5 max-w-[42ch] text-sm leading-6 text-[rgba(214,230,226,0.84)] md:text-[0.98rem]">
              Visibility alone doesn&apos;t change outcomes. Teams need a shared
              system for decisions and action.
            </p>
          </div>
        </div>
      </StoryContainer>
    </section>
  );
}

function ResolutionSection() {
  return (
    <section
      id="resolution"
      className="relative min-h-screen flex flex-col justify-center py-16 md:py-20"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(34%_30%_at_82%_20%,rgba(96,178,151,0.12),transparent_72%)]" />

      <StoryContainer className="max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full border border-[#B9D4CB] bg-[rgba(62,138,118,0.06)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3E8A76]">
            Solution
          </div>

          <div className="mt-6 max-w-4xl">
            <h2 className="text-[1.95rem] font-semibold leading-[1.08] tracking-tight text-[#0F1F1A] sm:text-[2.15rem] md:text-[2.5rem]">
              So we built KCX. Not another dashboard.
            </h2>
            <p className="mt-4 max-w-[50ch] mx-auto text-sm leading-7 text-[#445A53] md:text-base">
              We focused on operating behavior, not reporting surfaces.
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="relative">
            <div className="absolute left-0 top-0 h-full w-[3px] rounded-full bg-[linear-gradient(180deg,#3E8A76,rgba(62,138,118,0.18))]" />
            <div className="pl-6 md:pl-8">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#3E8A76]">
                Built for alignment
              </p>

              <h3 className="mt-4 max-w-[15ch] text-[1.85rem] font-semibold leading-[1.04] tracking-tight text-[#0F1F1A] md:text-[2.3rem]">
                An operating system for cloud cost.
              </h3>

              <p className="mt-4 max-w-[42ch] text-sm leading-7 text-[#445A53] md:text-[0.98rem] md:leading-7">
                Built to align finance, engineering, and leadership around the
                same decisions before overspend becomes the outcome.
              </p>

              <div className="mt-6 inline-flex items-center rounded-full bg-[#EAF5F1] px-3 py-1 text-[11px] font-medium text-[#3E8A76]">
                replaces dashboards
              </div>
            </div>
          </div>

          <aside className="rounded-[26px] border border-[#D9E5E1] bg-white p-6 shadow-[0_14px_30px_-24px_rgba(21,37,49,0.2)] md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6A8078]">
              Operating Outcomes
            </p>

            <ul className="mt-6 space-y-5">
              <li className="flex items-start gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#3E8A76]" />
                <div>
                  <p className="text-[1.05rem] font-semibold text-[#0F1F1A]">
                    share context
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#445A53]">
                    Everyone works from the same operating picture.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#3E8A76]" />
                <div>
                  <p className="text-[1.05rem] font-semibold text-[#0F1F1A]">
                    define ownership
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#445A53]">
                    Accountability becomes explicit and actionable.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-[#3E8A76]" />
                <div>
                  <p className="text-[1.05rem] font-semibold text-[#0F1F1A]">
                    act earlier
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#445A53]">
                    Teams can respond before overspend becomes the result.
                  </p>
                </div>
              </li>
            </ul>
          </aside>
        </div>
      </StoryContainer>
    </section>
  );
}

function TransformationSection() {
  return (
    <section
      id="transformation"
      className="relative min-h-screen flex flex-col justify-center py-16 md:py-20"
    >
      <StoryContainer className="max-w-6xl">
        <div className="flex flex-col items-center text-center">
          <SectionChip label="Transformation" />

          <div className="mt-6 max-w-4xl">
            <h2 className="text-[1.95rem] font-semibold leading-[1.08] tracking-tight text-[#0F1F1A] sm:text-[2.15rem] md:text-[2.5rem]">
              With KCX, teams move from reactive to intentional.
            </h2>
            <p className="mt-4 max-w-[52ch] mx-auto text-sm leading-7 text-[#445A53] md:text-base">
              A clearer operating rhythm: earlier signal, explicit ownership,
              and action built into the day-to-day.
            </p>
          </div>
        </div>

        <div className="relative mt-12 hidden lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-0">
          {TRANSFORMATION_STEPS.map((step, index) => (
            <Fragment key={step}>
              <article className="group relative overflow-hidden rounded-[22px] border border-[#D9E5E1] bg-white shadow-[0_12px_24px_-20px_rgba(21,37,49,0.14)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-20px_rgba(21,37,49,0.18)]">
                {/* header */}
                <div className="border-b border-[#E7EFEC] bg-[linear-gradient(180deg,#F8FCFA_0%,#F2F8F5_100%)] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#C8DAD4] bg-[#E2F3EE] text-xs font-semibold text-[#2F7F68]">
                        {index + 1}
                      </span>
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[#3E8A76]">
                        {index === 0
                          ? "Signal"
                          : index === 1
                            ? "Ownership"
                            : "Action"}
                      </p>
                    </div>

                    <span className="h-2 w-2 rounded-full bg-[#7FB7A7]" />
                  </div>
                </div>

                {/* body */}
                <div className="px-4 py-4">
                  <p className="max-w-[16ch] text-[1.05rem] font-semibold leading-[1.25] tracking-tight text-[#0F1F1A]">
                    {step}
                  </p>

                  <p className="mt-2 text-[0.85rem] leading-6 text-[#5D746C]">
                    {TRANSFORMATION_NOTES[index]}
                  </p>

                  {/* micro label */}
                  <div className="mt-4 flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[#7A9189]">
                    <span className="h-px w-6 bg-[#D6E4DE]" />
                    <span>
                      {index === 0
                        ? "Earlier visibility"
                        : index === 1
                          ? "Clear accountability"
                          : "Daily execution"}
                    </span>
                  </div>
                </div>

                {/* bottom accent */}
                <div className="absolute inset-x-0 bottom-0 h-[2px] bg-[linear-gradient(90deg,rgba(62,138,118,0.12),rgba(62,138,118,0.5),rgba(62,138,118,0.12))]" />
              </article>

              {/* connector */}
              {index < TRANSFORMATION_STEPS.length - 1 ? (
                <div className="flex items-center justify-center px-2">
                  <div className="h-px w-8 bg-[linear-gradient(90deg,rgba(62,138,118,0.12),rgba(62,138,118,0.4),rgba(62,138,118,0.12))]" />
                </div>
              ) : null}
            </Fragment>
          ))}
        </div>
      </StoryContainer>
    </section>
  );
}

function MissionVisionSection() {
  return (
    <section id="mission-vision" className="py-10 md:py-14">
      <StoryContainer className="max-w-5xl">
        <SectionChip label="Direction" />

        <div className="relative overflow-hidden rounded-[32px] border border-[#D9E5E1] bg-white shadow-[0_16px_36px_-24px_rgba(21,37,49,0.22)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(34%_42%_at_0%_100%,rgba(99,209,175,0.05),transparent_72%),radial-gradient(34%_42%_at_100%_0%,rgba(99,209,175,0.07),transparent_72%)]" />

          <div className="relative grid md:grid-cols-2">
            <article className="p-7 md:p-9">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-[#C8DAD4] bg-[#EAF5F1] text-[#2F7F68] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <Flag className="h-7 w-7" aria-hidden="true" />
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6A8078]">
                    Mission
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#445A53]">
                    What teams can do now
                  </p>
                </div>
              </div>

              <p className="mt-7 max-w-[16ch] text-[1.45rem] font-semibold leading-[1.18] tracking-tight text-[#0F1F1A] md:text-[1.75rem]">
                Help teams act on cloud cost with clarity.
              </p>

              <p className="mt-4 max-w-[34ch] text-sm leading-7 text-[#445A53] md:text-[0.98rem]">
                Make decisions easier to understand, assign, and act on.
              </p>

              <div className="mt-6 flex items-center gap-2 text-[0.78rem] font-medium uppercase tracking-[0.12em] text-[#6A8078]">
                <Layers3 className="h-4 w-4 text-[#3E8A76]" />
                <span>Focus: clear execution</span>
              </div>
            </article>

            <article className="border-t border-[#D9E5E1] p-7 md:border-l md:border-t-0 md:p-9">
              <div className="flex items-start gap-4">
                <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-[#C8DAD4] bg-[#F1F6FB] text-[#3E6E8A] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <Compass className="h-7 w-7" aria-hidden="true" />
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6A8078]">
                    Vision
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#445A53]">
                    Where the system is going
                  </p>
                </div>
              </div>

              <p className="mt-7 max-w-[17ch] text-[1.45rem] font-semibold leading-[1.18] tracking-tight text-[#0F1F1A] md:text-[1.75rem]">
                Make cloud economics a core operating system.
              </p>

              <p className="mt-4 max-w-[36ch] text-sm leading-7 text-[#445A53] md:text-[0.98rem]">
                Turn cloud cost into a shared system for planning, ownership,
                and execution.
              </p>

              <div className="mt-6 flex items-center gap-2 text-[0.78rem] font-medium uppercase tracking-[0.12em] text-[#6A8078]">
                <ArrowRight
                  className="h-4 w-4 text-[#3E6E8A]"
                  aria-hidden="true"
                />
                <span>Focus: system design</span>
              </div>
            </article>
          </div>
        </div>
      </StoryContainer>
    </section>
  );
}

const VALUE_ICONS = [Layers3, ShieldCheck, Users, TrendingUp];

function ValuesSection() {
  return (
    <ChapterShell
      id="values"
      chipLabel="Values"
      title="Values that shape how we build"
      className="py-10 md:py-14"
      titleClassName="text-center md:text-[1.95rem]"
    >
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {VALUES.map((value, index) => {
          const Icon = VALUE_ICONS[index];

          return (
            <article
              key={value}
              className="group relative overflow-hidden rounded-[22px] border border-[#D9E5E1] bg-white p-6 shadow-[0_14px_30px_-22px_rgba(21,37,49,0.18)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(21,37,49,0.28)]"
            >
              {/* top accent */}
              <div className="absolute left-0 top-0 h-[3px] w-full bg-[linear-gradient(90deg,#3E8A76,rgba(62,138,118,0.2))]" />

              <div className="flex items-start gap-4">
                {/* icon */}
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[#C8DAD4] bg-[#EAF5F1] text-[#2F7F68] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  {/* title */}
                  <p className="text-[1.1rem] font-semibold leading-[1.3] tracking-tight text-[#0F1F1A] md:text-[1.2rem]">
                    {value}
                  </p>

                  {/* description */}
                  <p className="mt-2 text-[0.9rem] leading-6 text-[#445A53]">
                    {VALUE_SUPPORT[value]}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </ChapterShell>
  );
}

function StoryCtaSection() {
  return (
    <section
      id="story-cta"
      aria-labelledby="story-cta-title"
      data-header-theme="dark"
      className="relative overflow-hidden bg-[#06101a] py-12 text-white md:py-16"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(58%_72%_at_84%_20%,rgba(102,210,179,0.18),transparent_72%),radial-gradient(48%_54%_at_14%_86%,rgba(75,128,210,0.16),transparent_72%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:68px_68px]" />

      <StoryContainer className="relative max-w-5xl">
        <SectionChip label="Next Step" tone="dark" />
        <h2
          id="story-cta-title"
          className="max-w-4xl text-balance text-[1.85rem] font-semibold leading-[1.05] tracking-[-0.035em] md:text-[2.5rem]"
        >
          If this problem feels familiar, we should talk.
        </h2>
        <p className="mt-3 max-w-[62ch] text-sm leading-7 text-[rgba(214,230,226,0.82)] md:text-base">
          We can compare approaches and share what has worked for teams building
          better cloud cost ownership.
        </p>
        <div className="mt-6">
          <a
            href="#"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[rgba(163,247,221,0.45)] bg-[linear-gradient(135deg,rgba(96,191,163,0.9)_0%,rgba(79,165,142,0.9)_100%)] px-6 py-3 text-sm font-semibold text-[#06111b] shadow-[0_10px_26px_rgba(72,169,145,0.24)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(189,255,233,0.7)] hover:shadow-[0_14px_34px_rgba(72,169,145,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#06101a]"
          >
            Talk to us
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </StoryContainer>
    </section>
  );
}

export function OurStoryPage() {
  return (
    <>
      <StoryHero />

      <main
        data-header-theme="light"
        className="bg-[linear-gradient(180deg,#F5F8F7_0%,#EEF4F2_100%)]"
      >
        <TensionSection />
        <InsightSection />
        <ResolutionSection />
        <TransformationSection />
        <MissionVisionSection />
        <ValuesSection />
        <StoryCtaSection />
      </main>

      <PageFooter />
    </>
  );
}
