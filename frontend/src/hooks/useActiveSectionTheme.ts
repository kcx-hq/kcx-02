import { useEffect, useRef, useState } from "react"

export type SectionTheme = "light" | "dark"

type UseActiveSectionThemeOptions = {
  selector?: string
  defaultTheme?: SectionTheme
  stickyOffsetPx?: number
}

const DEFAULT_SELECTOR = "[data-header-theme]"
const DEFAULT_STICKY_OFFSET = 92
const HYSTERESIS = 0.04

function readTheme(node: HTMLElement, fallback: SectionTheme): SectionTheme {
  const value = node.dataset.headerTheme
  return value === "light" || value === "dark" ? value : fallback
}

export function useActiveSectionTheme({
  selector = DEFAULT_SELECTOR,
  defaultTheme = "dark",
  stickyOffsetPx = DEFAULT_STICKY_OFFSET,
}: UseActiveSectionThemeOptions = {}) {
  const [theme, setTheme] = useState<SectionTheme>(defaultTheme)
  const activeIdRef = useRef<string>("")
  const activeScoreRef = useRef<number>(0)
  const sectionsRef = useRef<HTMLElement[]>([])
  const ratioMapRef = useRef<Map<HTMLElement, number>>(new Map())

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(selector))
    sectionsRef.current = sections
    ratioMapRef.current = new Map(sections.map((section) => [section, 0]))

    if (!sections.length) {
      setTheme(defaultTheme)
      return
    }

    const chooseBestSection = () => {
      const probeY = stickyOffsetPx + 8
      let winner: HTMLElement | null = null
      let winnerScore = -1

      for (const section of sectionsRef.current) {
        const rect = section.getBoundingClientRect()
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue

        const ratio = ratioMapRef.current.get(section) ?? 0
        const containsProbe = rect.top <= probeY && rect.bottom > probeY
        const proximity = Math.max(0, 1 - Math.abs(rect.top - probeY) / window.innerHeight)
        const score = ratio + (containsProbe ? 0.45 : 0) + proximity * 0.08

        if (score > winnerScore) {
          winner = section
          winnerScore = score
        }
      }

      if (!winner) return

      const nextId = winner.id || winner.dataset.headerTheme || String(winnerScore)
      const currentId = activeIdRef.current
      const currentScore = activeScoreRef.current

      if (nextId !== currentId && winnerScore + HYSTERESIS < currentScore) return

      activeIdRef.current = nextId
      activeScoreRef.current = winnerScore
      setTheme(readTheme(winner, defaultTheme))
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratioMapRef.current.set(entry.target as HTMLElement, entry.intersectionRatio)
        }
        chooseBestSection()
      },
      {
        root: null,
        rootMargin: `-${stickyOffsetPx}px 0px -48% 0px`,
        threshold: [0, 0.08, 0.2, 0.35, 0.5, 0.7, 0.9, 1],
      }
    )

    sections.forEach((section) => observer.observe(section))

    const onResize = () => chooseBestSection()
    window.addEventListener("resize", onResize)
    chooseBestSection()

    return () => {
      observer.disconnect()
      window.removeEventListener("resize", onResize)
    }
  }, [defaultTheme, selector, stickyOffsetPx])

  return theme
}

