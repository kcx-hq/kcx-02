interface FlowPipeProps {
  /** index used to namespace gradient / filter IDs */
  index: number
  /** vertical center offset as fraction of card height (0-1), default 0.5 */
  vCenter?: number
  /** optional custom width to tighten/expand connector spacing */
  width?: number
  /** phase delay to desynchronize particle/sweep animation */
  delayMs?: number
}

export function FlowPipe({ index, vCenter = 0.5, width = 72, delayMs = 0 }: FlowPipeProps) {
  const W = width
  const H = 56
  const cy = H * vCenter
  const x0 = 2
  const x1 = W - 2

  const path = `M ${x0},${cy} C ${x0 + 18},${cy} ${x1 - 18},${cy} ${x1},${cy}`

  const gradId = `fp-grad-${index}`
  const blurId = `fp-blur-${index}`
  const trackId = `fp-track-${index}`
  const dashId = `fp-dash-${index}`
  const sweepId = `fp-sweep-${index}`
  const sparkColor = index % 2 === 0 ? "#a7f6de" : "#8be6ff"

  return (
    <div
      className="hidden flex-shrink-0 select-none items-center justify-center lg:flex"
      style={{ width: `${W}px` }}
      aria-hidden="true"
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a6b58" stopOpacity="0.55" />
            <stop offset="35%" stopColor="#23a282" stopOpacity="0.92" />
            <stop offset="65%" stopColor="#23a282" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#1a6b58" stopOpacity="0.55" />
          </linearGradient>

          <linearGradient id={trackId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#071812" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#0d2a20" stopOpacity="1" />
            <stop offset="100%" stopColor="#071812" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id={dashId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6cd9bb" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#9cf3dc" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#6cd9bb" stopOpacity="0.08" />
          </linearGradient>

          <linearGradient id={sweepId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="48%" stopColor="#ccfff0" stopOpacity="0.94" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <filter id={blurId} x="-60%" y="-420%" width="220%" height="940%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        <path d={path} stroke={`url(#${trackId})`} strokeWidth="6" strokeLinecap="round" />
        <path d={path} stroke={`url(#${gradId})`} strokeWidth="3.5" strokeLinecap="round" opacity="0.22" />
        <path d={path} stroke="#23a282" strokeWidth="6" strokeLinecap="round" opacity="0.28" filter={`url(#${blurId})`} />
        <path d={path} stroke={`url(#${gradId})`} strokeWidth="1.4" strokeLinecap="round" opacity="0.86" />
        <path d={path} stroke={`url(#${dashId})`} strokeWidth="1" strokeLinecap="round" strokeDasharray="3 4" opacity="0.68" />
        <path d={path} stroke={`url(#${sweepId})`} strokeWidth="2.3" strokeLinecap="round" opacity="0.8" strokeDasharray="28 250">
          <animate
            attributeName="stroke-dashoffset"
            values="-240;0"
            dur="2.9s"
            begin={`${delayMs}ms`}
            repeatCount="indefinite"
          />
        </path>

        <circle cx={x0} cy={cy} r="4" fill="#0c2419" stroke="#23a282" strokeWidth="1" />
        <circle cx={x0} cy={cy} r="7" fill="none" stroke="#23a282" strokeWidth="0.4" opacity="0.35" />

        <circle cx={x1} cy={cy} r="4" fill="#0c2419" stroke="#23a282" strokeWidth="1" />
        <circle cx={x1} cy={cy} r="7" fill="none" stroke="#23a282" strokeWidth="0.4" opacity="0.35" />

        <polyline
          points={`${x1 - 8},${cy - 4.5} ${x1 - 1},${cy} ${x1 - 8},${cy + 4.5}`}
          stroke="#4cd5b0"
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.78"
        />

        {[0, 1].map((i) => (
          <circle key={i} r="0" fill={sparkColor} opacity="0">
            <animate attributeName="r" values="0;2.3;2.3;0" dur="2.1s" begin={`${delayMs / 1000 + i * 1}s`} repeatCount="indefinite" />
            <animate
              attributeName="opacity"
              values="0;0.95;0.85;0"
              dur="2.1s"
              begin={`${delayMs / 1000 + i * 1}s`}
              repeatCount="indefinite"
            />
            <animateMotion
              path={path}
              dur="2.1s"
              begin={`${delayMs / 1000 + i * 1}s`}
              repeatCount="indefinite"
              rotate="auto"
            />
          </circle>
        ))}

        <circle r="0" fill="#8ef0d2" opacity="0">
          <animate attributeName="r" values="0;3.1;3.1;0" dur="1.9s" begin={`${delayMs / 1000}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0.92;0" dur="1.9s" begin={`${delayMs / 1000}s`} repeatCount="indefinite" />
          <animateMotion path={path} dur="2.1s" begin={`${delayMs / 1000}s`} repeatCount="indefinite" rotate="auto" />
        </circle>
      </svg>
    </div>
  )
}
