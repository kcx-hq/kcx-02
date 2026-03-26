import { AuroraBackground } from "@/components/brand/AuroraBackground"

type PageHeroProps = {
  eyebrow: string
  title: string
  description: string
  variant?: "about" | "resources"
}

export function PageHero({
  eyebrow,
  title,
  description,
  variant = "about",
}: PageHeroProps) {
  const overlayClass =
    variant === "resources"
      ? "bg-[radial-gradient(60%_44%_at_78%_20%,rgba(102,210,179,0.10),transparent_72%),radial-gradient(40%_28%_at_18%_24%,rgba(75,128,210,0.08),transparent_74%)]"
      : "bg-[radial-gradient(56%_40%_at_74%_18%,rgba(102,210,179,0.08),transparent_72%),radial-gradient(36%_26%_at_20%_24%,rgba(75,128,210,0.07),transparent_74%)]"

  return (
    <section
      data-header-theme="dark"
      className="relative isolate overflow-hidden border-b border-white/10 bg-[#07111c] pb-16 pt-32 text-white md:pb-20 md:pt-36"
    >
      <div className="absolute inset-0 opacity-70">
        <AuroraBackground />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,12,18,0.82)_0%,rgba(7,14,20,0.74)_45%,rgba(8,16,23,0.92)_100%)]" />

      <div className={`pointer-events-none absolute inset-0 ${overlayClass}`} />

      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:72px_72px]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(7,14,20,0)_0%,rgba(7,14,20,0.45)_55%,rgba(10,18,24,0.92)_100%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 md:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(148,224,198,0.92)]">
          {eyebrow}
        </p>

        <h1 className="mt-4 max-w-4xl text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
          {title}
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-7 text-[rgba(214,230,226,0.84)] md:text-lg">
          {description}
        </p>
      </div>
    </section>
  )
}
