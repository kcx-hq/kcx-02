import { motion } from "framer-motion"
import { useEffect, useId, useMemo, useRef, useState } from "react"

import awsIcon from "@/assets/icons/aws.svg"
import azureIcon from "@/assets/icons/azure.svg"
import gcpIcon from "@/assets/icons/gcp.svg"
import oracleIcon from "@/assets/icons/oracle.svg"

const NORMALIZATION_SOURCES = [
  { name: "AWS", src: awsIcon, key: "aws-a", xOffset: 8 },
  { name: "GCP", src: gcpIcon, key: "gcp", xOffset: 0 },
  { name: "AZURE", src: azureIcon, key: "azure", xOffset: 12 },
  { name: "ORACLE", src: oracleIcon, key: "oracle", xOffset: 4 },
] as const

export function NormalizationVisual() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 620, height: 304 })
  const id = useId().replace(/:/g, "")

  useEffect(() => {
    const node = rootRef.current
    if (!node) return

    const update = () => {
      const next = { width: node.clientWidth, height: node.clientHeight }
      if (next.width > 0 && next.height > 0) {
        setCanvasSize(next)
      }
    }

    update()
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(node)
    return () => resizeObserver.disconnect()
  }, [])

  const sourceCount = NORMALIZATION_SOURCES.length
  const verticalPad = Math.max(12, Math.min(24, canvasSize.height * 0.06))
  const minNodeGap = 10
  const maxIconByHeight = (canvasSize.height - verticalPad * 2 - minNodeGap * (sourceCount - 1)) / sourceCount
  const iconSize = Math.max(50, Math.min(76, maxIconByHeight))
  const leftInset = Math.max(10, Math.min(24, canvasSize.width * 0.025))
  const minCenterY = iconSize / 2 + 12
  const maxCenterY = canvasSize.height - iconSize / 2 - 12
  const naturalGap = Math.max(iconSize + minNodeGap, Math.min(110, canvasSize.height * 0.2))
  const span = maxCenterY - minCenterY
  const gap = sourceCount > 1 ? Math.min(naturalGap, span / (sourceCount - 1)) : 0
  const stackHeight = gap * Math.max(0, sourceCount - 1)
  const centeredTop = (canvasSize.height - stackHeight) / 2
  const top = Math.max(minCenterY, Math.min(centeredTop, maxCenterY - stackHeight))

  const sources = useMemo(
    () =>
      NORMALIZATION_SOURCES.map((source, index) => ({
        ...source,
        y: top + gap * index,
        x: leftInset + source.xOffset,
      })),
    [gap, leftInset, top],
  )

  const sinkX = canvasSize.width + 6
  const sinkY = Math.max(iconSize / 2 + 12, Math.min(canvasSize.height - iconSize / 2 - 12, canvasSize.height * 0.5))
  const outEndX = sinkX + Math.max(28, Math.min(42, canvasSize.width * 0.12))
  const outDx = Math.max(20, outEndX - sinkX)
  const outPath = `M ${sinkX} ${sinkY} C ${sinkX + outDx * 0.42} ${sinkY}, ${outEndX - outDx * 0.26} ${sinkY}, ${outEndX} ${sinkY}`
  const lineGradientId = `ingest-line-kcx-${id}`
  const lineGlowId = `ingest-glow-kcx-${id}`

  return (
    <div className="flex h-full w-full flex-col">
      <div
        ref={rootRef}
        className="relative min-h-[17.5rem] flex-1 overflow-visible"
        style={{
          backgroundImage: "radial-gradient(rgba(83,188,162,0.14) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(62%_72%_at_12%_45%,rgba(43,156,130,0.16),transparent_72%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(52%_46%_at_80%_50%,rgba(56,164,205,0.08),transparent_74%)]" />

        <svg
          viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id={lineGradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(96,190,162,0.22)" />
              <stop offset="50%" stopColor="rgba(143,236,209,0.92)" />
              <stop offset="100%" stopColor="rgba(96,190,162,0.28)" />
            </linearGradient>

            <filter id={lineGlowId} x="-30%" y="-120%" width="160%" height="360%">
              <feGaussianBlur stdDeviation="2.8" />
            </filter>
          </defs>

          {sources.map((source, i) => {
            const startX = source.x + iconSize
            const dx = sinkX - startX
            const c1x = startX + Math.max(34, dx * 0.32)
            const c2x = sinkX - Math.max(42, dx * 0.28)
            const path = `M ${startX} ${source.y} C ${c1x} ${source.y}, ${c2x} ${sinkY}, ${sinkX} ${sinkY}`
            return (
              <g key={source.key}>
                <path d={path} stroke={`url(#${lineGradientId})`} strokeWidth="2.1" fill="none" />
                <path d={path} stroke="rgba(79,201,176,0.24)" strokeWidth="5.4" fill="none" filter={`url(#${lineGlowId})`} />
                <circle r="0" fill="#c5f6e6" opacity="0">
                  <animate attributeName="r" values="0;2.1;2.1;0" dur="2.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;0.95;0.85;0" dur="2.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                  <animateMotion path={path} dur="2.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" rotate="auto" />
                </circle>
              </g>
            )
          })}

          <circle cx={sinkX} cy={sinkY} r="6" fill="rgba(9,37,47,0.95)" stroke="rgba(157,236,212,0.78)" strokeWidth="1.1" />
          <circle cx={sinkX} cy={sinkY} r="10.5" fill="none" stroke="rgba(157,236,212,0.24)" strokeWidth="0.9">
            <animate attributeName="r" values="8;13;8" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0.25;0.7" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <path d={outPath} stroke={`url(#${lineGradientId})`} strokeWidth="2.7" fill="none" />

          <circle r="0" fill="#c5f6e6" opacity="0">
            <animate attributeName="r" values="0;2.5;2.5;0" dur="2.1s" begin="0.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0.85;0" dur="2.1s" begin="0.2s" repeatCount="indefinite" />
            <animateMotion path={outPath} dur="2.1s" begin="0.2s" repeatCount="indefinite" rotate="auto" />
          </circle>
        </svg>

        <div className="absolute inset-0">
          {sources.map((source) => (
            <motion.div
              key={source.key}
              className="absolute flex items-center justify-center rounded-full border border-[rgba(122,205,179,0.46)] bg-[linear-gradient(180deg,rgba(228,243,249,0.96),rgba(198,221,231,0.92))] shadow-[0_10px_20px_-10px_rgba(0,0,0,0.45)]"
              style={{
                left: `${source.x}px`,
                top: `${source.y - iconSize / 2}px`,
                width: `${iconSize}px`,
                height: `${iconSize}px`,
              }}
              initial={{ x: -4, opacity: 0.88 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3 }}
              animate={{
                boxShadow: [
                  "0 10px 20px -10px rgba(0,0,0,0.45)",
                  "0 13px 25px -8px rgba(112,202,176,0.34)",
                  "0 10px 20px -10px rgba(0,0,0,0.45)",
                ],
              }}
            >
              <div className="flex items-center justify-center">
                {source.src ? (
                  <img src={source.src} alt={source.name} className="h-[62%] w-[62%] object-contain" />
                ) : (
                  <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#1e3d4f]">+</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function VisibilityPrismVisual() {
  const stages = ["Data validation", "Data cleaning", "Data transformation", "Data aggregation", "Data loading"]
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % stages.length)
    }, 1300)
    return () => window.clearInterval(id)
  }, [stages.length])

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-[rgba(98,186,160,0.24)] bg-[linear-gradient(160deg,rgba(8,31,43,0.72),rgba(5,18,28,0.9))] p-3.5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_56%_at_10%_16%,rgba(87,190,163,0.15),transparent_74%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(44%_46%_at_88%_68%,rgba(83,177,217,0.12),transparent_72%)]" />

      <svg viewBox="0 0 340 152" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="process-flow-kcx" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(102,193,166,0.22)" />
            <stop offset="50%" stopColor="rgba(135,225,197,0.6)" />
            <stop offset="100%" stopColor="rgba(102,193,166,0.22)" />
          </linearGradient>
        </defs>
        <path d="M 6 76 C 54 76, 94 76, 134 76" stroke="url(#process-flow-kcx)" strokeWidth="1.5" fill="none" />
        <circle r="0" fill="#b6f3de" opacity="0">
          <animate attributeName="r" values="0;2.1;2.1;0" dur="2.1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.95;0.85;0" dur="2.1s" repeatCount="indefinite" />
          <animateMotion path="M 6 76 C 54 76, 94 76, 134 76" dur="2.1s" repeatCount="indefinite" rotate="auto" />
        </circle>
      </svg>

      <div className="relative grid grid-cols-[1fr_92px] gap-3">
        <div className="space-y-2">
          <div className="rounded-xl border border-[rgba(101,193,166,0.36)] bg-[rgba(7,36,48,0.76)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[rgba(163,236,214,0.92)]">Processing KPI</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-[rgba(204,232,223,0.92)]">Quality score</p>
              <svg viewBox="0 0 100 58" className="h-8 w-14">
                <path d="M8 50 A42 42 0 0 1 92 50" fill="none" stroke="rgba(80,156,181,0.32)" strokeWidth="8" strokeLinecap="round" />
                <path d="M8 50 A42 42 0 0 1 84 28" fill="none" stroke="rgba(117,226,197,0.9)" strokeWidth="8" strokeLinecap="round" />
                <circle cx="50" cy="50" r="4" fill="rgba(176,247,225,0.95)" />
              </svg>
            </div>
          </div>

          <div className="relative space-y-2 pl-3">
            <div className="pointer-events-none absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-[rgba(114,205,178,0.24)]" />
            {stages.map((stage, i) => (
              <motion.div
                key={stage}
                className="relative rounded-xl px-3 py-2 text-[11px] font-medium text-[rgba(203,229,221,0.95)]"
                initial={{ y: 6, opacity: 0.82 }}
                whileInView={{ y: 0, opacity: 1 }}
                animate={{
                  borderColor: i <= activeStep ? "rgba(130,225,198,0.54)" : "rgba(98,186,160,0.32)",
                  backgroundColor: i <= activeStep ? "rgba(8,40,52,0.88)" : "rgba(8,34,45,0.72)",
                  boxShadow: i === activeStep ? "0 0 0 1px rgba(141,237,210,0.34), 0 0 16px rgba(87,214,182,0.2)" : "none",
                }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
              >
                <span className="pointer-events-none absolute -left-[11px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-full border border-[rgba(159,235,212,0.58)] bg-[rgba(8,38,50,0.92)]" />
                {stage}
                {i === activeStep ? (
                  <motion.span
                    className="absolute right-2 top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full bg-[rgba(167,247,225,0.92)]"
                    animate={{ scale: [1, 1.5, 1], opacity: [0.85, 0.4, 0.85] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  />
                ) : null}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative flex items-end justify-center">
          <svg viewBox="0 0 90 164" className="h-full w-full max-h-[164px]">
            <defs>
              <linearGradient id="warehouse-body-kcx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(122,226,197,0.45)" />
                <stop offset="100%" stopColor="rgba(57,122,151,0.18)" />
              </linearGradient>
              <linearGradient id="warehouse-edge-kcx" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(115,214,188,0.62)" />
                <stop offset="100%" stopColor="rgba(96,180,220,0.58)" />
              </linearGradient>
            </defs>
            <ellipse cx="45" cy="26" rx="30" ry="11" fill="rgba(13,50,64,0.95)" stroke="url(#warehouse-edge-kcx)" strokeWidth="1.3" />
            <rect x="15" y="26" width="60" height="102" rx="28" fill="url(#warehouse-body-kcx)" stroke="url(#warehouse-edge-kcx)" strokeWidth="1.3" />
            {[0, 1, 2].map((i) => (
              <ellipse
                key={i}
                cx="45"
                cy={46 + i * 24}
                rx="27"
                ry="9"
                fill="none"
                stroke="rgba(120,219,192,0.34)"
                strokeWidth="1.1"
              />
            ))}
            <ellipse cx="45" cy="128" rx="30" ry="11" fill="rgba(8,35,47,0.96)" stroke="url(#warehouse-edge-kcx)" strokeWidth="1.3" />
          </svg>
        </div>
      </div>
    </div>
  )
}

export function InvestigationVisual() {
  return (
    <div className="space-y-2.5">
      {["Aggregation", "Anomaly detect", "Governance", "Optimization opportunity"].map((item, index) => (
        <motion.div
          key={item}
          className="relative rounded-xl border border-[rgba(98,186,160,0.3)] bg-[rgba(8,34,45,0.72)] px-3 py-2 text-[11px] text-[rgba(203,229,221,0.95)]"
          initial={{ x: -4, opacity: 0.86 }}
          whileInView={{ x: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.06, duration: 0.28 }}
        >
          {item}
        </motion.div>
      ))}
    </div>
  )
}

export function AIPriorityVisual() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {["Inform", "Optimize", "Operate"].map((item) => (
          <div
            key={item}
            className="rounded-xl border border-[rgba(98,186,160,0.3)] bg-[rgba(8,34,45,0.72)] px-3 py-2 text-[11px] text-[rgba(203,229,221,0.95)]"
          >
            {item}
          </div>
        ))}
      </div>

      <motion.div
        className="mx-auto h-[62px] w-[62px]"
        animate={{ rotate: [0, 360] }}
        transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r="45" fill="rgba(9,33,44,0.7)" stroke="rgba(104,196,167,0.5)" strokeWidth="2" />
          <path d="M50 50 L50 8 A42 42 0 0 1 88 64 Z" fill="rgba(74,179,148,0.45)" />
          <path d="M50 50 L88 64 A42 42 0 0 1 14 73 Z" fill="rgba(63,139,181,0.34)" />
          <path d="M50 50 L14 73 A42 42 0 0 1 50 8 Z" fill="rgba(104,196,167,0.22)" />
          <circle cx="50" cy="50" r="4" fill="rgba(182,244,225,0.95)" />
        </svg>
      </motion.div>
    </div>
  )
}
