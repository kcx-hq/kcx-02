import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export interface WorkflowCardProps {
  phase: string
  stepNumber: string
  stepLabel: string
  title: string
  description: string
  icon: LucideIcon
  accentColor?: string
  children: ReactNode
  index: number
  visualOnly?: boolean
  allowOverflow?: boolean
}

export function WorkflowCard({
  phase,
  stepNumber,
  stepLabel,
  title,
  description,
  icon: Icon,
  accentColor = "#23a282",
  children,
  index,
  visualOnly = false,
  allowOverflow = false,
}: WorkflowCardProps) {
  if (visualOnly) {
    return (
      <motion.div
        className="relative z-10 flex min-w-0 flex-col lg:self-center"
        style={{ flex: "1.02 1 0" }}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-64px" }}
        transition={{
          delay: index * 0.1,
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div>{children}</div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="relative z-10 flex min-w-0 flex-col"
      style={{ flex: "1 1 0" }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-64px" }}
      transition={{
        delay: index * 0.1,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover="hovered"
    >
      <motion.div
        className="pointer-events-none absolute"
        style={{
          inset: "-24px -16px",
          background: `radial-gradient(60% 55% at 50% 50%, ${accentColor}14 0%, transparent 70%)`,
          filter: "blur(12px)",
          zIndex: 0,
        }}
        variants={{ hovered: { opacity: 1.6 } }}
      />

      <motion.div
        className={`kcx-premium-card kcx-engine-card relative flex h-full min-h-[29rem] flex-col rounded-[14px] ${
          allowOverflow ? "overflow-visible" : "overflow-hidden"
        }`}
        style={{
          background: "linear-gradient(160deg, rgba(12, 25, 35, 0.97) 0%, rgba(8, 18, 28, 0.99) 100%)",
          border: "1px solid rgba(35, 162, 130, 0.15)",
          boxShadow: [
            "0 1px 0 rgba(167, 228, 207, 0.08) inset",
            "0 -1px 0 rgba(0, 0, 0, 0.45) inset",
            "0 24px 48px rgba(2, 8, 14, 0.55)",
            "0 4px 16px rgba(2, 8, 14, 0.35)",
          ].join(", "),
          zIndex: 1,
        }}
        variants={{
          hovered: {
            borderColor: "rgba(35, 162, 130, 0.36)",
            boxShadow: [
              "0 1px 0 rgba(167, 228, 207, 0.14) inset",
              "0 -1px 0 rgba(0, 0, 0, 0.45) inset",
              "0 32px 64px rgba(2, 8, 14, 0.65)",
              "0 4px 16px rgba(2, 8, 14, 0.4)",
              "0 0 0 1px rgba(35, 162, 130, 0.18)",
            ].join(", "),
          },
        }}
        transition={{ duration: 0.25 }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(35,162,130,0.34) 30%, rgba(35,162,130,0.44) 50%, rgba(35,162,130,0.34) 70%, transparent 100%)",
          }}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(35,162,130,0.055) 0%, transparent 65%)",
          }}
        />

        <div className="relative z-10 flex h-full flex-col gap-5 p-5">
          <div className="flex items-center justify-between gap-2">
            <span
              className="inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.11em]"
              style={{
                color: "#9de6ce",
                border: "1px solid rgba(74,173,145,0.44)",
                background: "rgba(8,44,56,0.8)",
              }}
            >
              {phase}
            </span>
          </div>

          {title ? (
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[rgba(74,173,145,0.4)] bg-[rgba(8,40,52,0.82)]">
                <Icon className="h-5 w-5 text-[rgba(165,237,215,0.95)]" />
              </span>
              <h3
                style={{
                  color: "#f2fbf8",
                  fontSize: "15px",
                  fontWeight: 700,
                  lineHeight: 1.28,
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                {title}
              </h3>
            </div>
          ) : null}

          {description ? (
            <p
              style={{
                margin: 0,
                color: "rgba(193,217,210,0.82)",
                fontSize: "11px",
                lineHeight: 1.65,
              }}
            >
              {description}
            </p>
          ) : null}

          <div className="min-h-0 flex-1">{children}</div>

          <div className="flex items-center gap-2 pt-1.5">
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: "rgba(166,238,216,0.92)",
                letterSpacing: "0.08em",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {stepNumber}
            </span>
            <span
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5"
              style={{
                border: "1px solid rgba(89,188,159,0.38)",
                background: "rgba(8,39,49,0.8)",
              }}
            >
              <span className="text-sm text-[rgba(168,240,219,0.92)]">-&gt;</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "rgba(167, 228, 207, 0.78)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {stepLabel}
              </span>
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
