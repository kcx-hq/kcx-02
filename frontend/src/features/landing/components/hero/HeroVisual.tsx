import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react"
import { useEffect, useState } from "react"

import awsIcon from "@/assets/icons/aws.svg"
import azureIcon from "@/assets/icons/azure.svg"
import gcpIcon from "@/assets/icons/gcp.svg"
import oracleIcon from "@/assets/icons/oracle.svg"
import { cn } from "@/lib/utils"

type VisualStage = "before" | "optimizing" | "after"

const cloudItems = [
  { icon: awsIcon, label: "AWS" },
  { icon: azureIcon, label: "Azure" },
  { icon: gcpIcon, label: "GCP" },
  { icon: oracleIcon, label: "Oracle" },
]

const BEFORE_CURVE = "M20 146 C 78 30, 136 184, 216 120 C 282 68, 338 170, 414 96 C 450 61, 488 130, 510 98"
const AFTER_CURVE = "M20 170 C 78 156, 138 134, 216 114 C 283 96, 341 80, 414 61 C 450 50, 488 34, 510 26"
const BEFORE_AREA = `${BEFORE_CURVE} L510 192 L20 192 Z`
const AFTER_AREA = `${AFTER_CURVE} L510 192 L20 192 Z`

const STAGE_DURATION: Record<VisualStage, number> = {
  before: 2200,
  optimizing: 1400,
  after: 2300,
}

export function HeroVisual() {
  const [stage, setStage] = useState<VisualStage>("before")

  useEffect(() => {
    let timeoutId: number | null = null

    const runLoop = (current: VisualStage) => {
      timeoutId = window.setTimeout(() => {
        const next =
          current === "before" ? "optimizing" : current === "optimizing" ? "after" : "before"
        setStage(next)
        runLoop(next)
      }, STAGE_DURATION[current])
    }

    runLoop("before")
    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [])

  const optimized = stage === "after"
  const transforming = stage === "optimizing"

  return (
    <div className="relative ml-auto w-full max-w-[40rem]">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-[34px] bg-[radial-gradient(circle_at_70%_22%,rgba(92,199,164,0.22),transparent_52%),radial-gradient(circle_at_22%_85%,rgba(65,167,137,0.18),transparent_60%)] blur-3xl transition-opacity duration-700",
          optimized ? "opacity-100" : transforming ? "opacity-85" : "opacity-65"
        )}
      />

      <article className="relative overflow-hidden rounded-[26px] border border-white/14 bg-[linear-gradient(180deg,rgba(13,24,32,0.96),rgba(9,17,24,0.96))] p-5 shadow-[0_34px_74px_-36px_rgba(3,8,12,0.92)] sm:p-6">
        <div
          className={cn(
            "pointer-events-none absolute -right-16 top-10 h-44 w-44 rounded-full blur-3xl transition-opacity duration-700",
            optimized
              ? "bg-[rgba(74,196,158,0.28)] opacity-100"
              : "bg-[rgba(239,148,95,0.2)] opacity-75"
          )}
        />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/55">Cloud Cost Posture</p>
            <p className="mt-1 text-sm font-medium text-white/94">
              {optimized ? "Optimized by KCX" : transforming ? "Optimizing with KCX" : "Before KCX"}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-500",
              optimized
                ? "bg-[rgba(35,162,130,0.2)] text-[rgba(164,237,215,0.98)]"
                : transforming
                  ? "bg-[rgba(58,126,171,0.2)] text-[rgba(173,216,244,0.95)]"
                  : "bg-[rgba(250,157,87,0.16)] text-[rgba(252,195,151,0.92)]"
            )}
          >
            {optimized ? <Sparkles className="h-3 w-3" /> : null}
            {optimized ? "Savings Found" : transforming ? "Optimization Running" : "Inefficient Spend"}
          </span>
        </div>

        <div className="relative mt-5 overflow-hidden rounded-xl border border-white/10 bg-[rgba(6,14,20,0.8)] p-4">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),transparent_35%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:42px_34px] opacity-70" />

          <div
            className={cn(
              "pointer-events-none absolute bottom-0 top-0 w-28 bg-[linear-gradient(90deg,transparent,rgba(146,234,205,0.28),transparent)] transition-transform duration-1000",
              transforming ? "translate-x-[360%]" : "-translate-x-[140%]"
            )}
          />

          <svg viewBox="0 0 530 200" className="relative h-40 w-full">
            <defs>
              <linearGradient id="kcx-before" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="rgba(247,158,99,0.92)" />
                <stop offset="100%" stopColor="rgba(232,123,74,0.8)" />
              </linearGradient>
              <linearGradient id="kcx-after" x1="0%" y1="50%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#9af2d3" />
                <stop offset="60%" stopColor="#61d8b2" />
                <stop offset="100%" stopColor="#38b68e" />
              </linearGradient>
              <linearGradient id="kcx-before-area" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(247,158,99,0.25)" />
                <stop offset="100%" stopColor="rgba(247,158,99,0)" />
              </linearGradient>
              <linearGradient id="kcx-after-area" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(97,216,178,0.32)" />
                <stop offset="100%" stopColor="rgba(97,216,178,0)" />
              </linearGradient>
            </defs>

            <path
              d={BEFORE_AREA}
              fill="url(#kcx-before-area)"
              className={cn(
                "origin-bottom transition-all duration-1000",
                optimized ? "scale-y-90 opacity-0" : transforming ? "opacity-35" : "opacity-100"
              )}
            />
            <path
              d={AFTER_AREA}
              fill="url(#kcx-after-area)"
              className={cn(
                "origin-bottom transition-all duration-1000",
                optimized ? "opacity-100" : transforming ? "opacity-65" : "opacity-0"
              )}
            />

            <path
              d={BEFORE_CURVE}
              stroke="url(#kcx-before)"
              strokeWidth="5.5"
              fill="none"
              strokeLinecap="round"
              className={cn(
                "transition-all duration-1000",
                optimized ? "translate-y-2 opacity-0" : transforming ? "opacity-40" : "opacity-100"
              )}
            />
            <path
              d={AFTER_CURVE}
              stroke="url(#kcx-after)"
              strokeWidth="5.5"
              fill="none"
              strokeLinecap="round"
              className={cn(
                "transition-all duration-1000",
                optimized ? "translate-y-0 opacity-100" : transforming ? "opacity-70" : "translate-y-[-4px] opacity-0"
              )}
            />
          </svg>

          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
              <p className="text-white/60">Waste</p>
              <p
                className={cn(
                  "mt-1 inline-flex items-center gap-1 text-sm font-semibold transition-colors duration-500",
                  optimized ? "text-[rgba(164,237,215,0.98)]" : "text-[rgba(252,195,151,0.92)]"
                )}
              >
                <ArrowDownRight className="h-3.5 w-3.5" />
                {optimized ? "11%" : "38%"}
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
              <p className="text-white/60">Savings Found</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[rgba(164,237,215,0.98)]">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {optimized ? "$186k" : "$0"}
              </p>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-2">
              <p className="text-white/60">Visibility</p>
              <p className="mt-1 text-sm font-semibold text-[#d4e7e1]">{optimized ? "92/100" : "57/100"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {cloudItems.map((cloud) => (
            <div
              key={cloud.label}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-500",
                optimized
                  ? "border-[rgba(133,228,197,0.36)] bg-[rgba(98,206,170,0.16)]"
                  : "border-white/12 bg-white/[0.06]"
              )}
            >
              <img src={cloud.icon} alt={cloud.label} className="h-4 w-auto object-contain" />
              <span className="text-xs font-medium text-white/86">{cloud.label}</span>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}
