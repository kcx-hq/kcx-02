import { AuroraBackground } from "@/components/brand/AuroraBackground"
import { HeroHeadline } from "@/features/landing/components/hero/HeroHeadline"
import { Reveal } from "@/components/motion/Reveal"
import { landingSectionIds } from "@/features/landing/utils/landingSectionIds"

export function Hero() {
  return (
    <section
      id={landingSectionIds.hero}
      data-header-theme="dark"
      className="relative isolate min-h-[100svh] w-full overflow-hidden pb-8 pt-[6.25rem] text-white sm:pb-10 md:pb-12 md:pt-[7rem] lg:pb-14"
      aria-label="KCX hero"
    >
      <AuroraBackground />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-44 bg-[linear-gradient(180deg,rgba(7,14,20,0)_0%,rgba(7,14,20,0.6)_58%,rgba(10,18,24,0.95)_100%)]" />

      <div className="kcx-container relative z-10 flex min-h-[calc(100svh-6.25rem)] items-center justify-center pb-8 md:min-h-[calc(100svh-7rem)] md:pb-10">
        <Reveal distance={30} delay={0.08} className="w-full max-w-[62rem]">
          <HeroHeadline className="max-w-[62rem]" />
        </Reveal>
      </div>
    </section>
  )
}
