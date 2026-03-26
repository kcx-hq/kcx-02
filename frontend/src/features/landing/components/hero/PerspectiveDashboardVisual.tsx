import { useCallback, useEffect, useRef, useState } from "react"

type MotionTarget = {
  x: number
  y: number
  hovering: boolean
  click: number
}

type MotionState = {
  x: number
  y: number
  hovering: number
  click: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const CLICK_PULSE_MS = 340
const AUTO_ROTATE_MS = 5200
const TRANSITION_MS = 1150

const sceneImages = [
  { key: "dark-primary", src: "/dashboard-client-dashboard.png" },
  { key: "light-depth", src: "/li.png" },
]

export function PerspectiveDashboardVisual() {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const targetRef = useRef<MotionTarget>({ x: 0, y: 0, hovering: false, click: 0 })
  const stateRef = useRef<MotionState>({ x: 0, y: 0, hovering: 0, click: 0 })
  const clickTimeoutRef = useRef<number | null>(null)
  const transitionTimeoutRef = useRef<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const transitionLockRef = useRef(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  const clearAutoInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const advanceScene = useCallback(() => {
    if (transitionLockRef.current) return false

    transitionLockRef.current = true
    setIsAnimating(true)
    setActiveIndex((prev) => (prev + 1) % sceneImages.length)

    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current)
    }

    transitionTimeoutRef.current = window.setTimeout(() => {
      setIsAnimating(false)
      transitionLockRef.current = false
      transitionTimeoutRef.current = null
    }, TRANSITION_MS)

    return true
  }, [])

  const startAutoInterval = useCallback(() => {
    clearAutoInterval()
    intervalRef.current = window.setInterval(() => {
      advanceScene()
    }, AUTO_ROTATE_MS)
  }, [advanceScene, clearAutoInterval])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    let rafId = 0

    const animate = () => {
      const target = targetRef.current
      const state = stateRef.current

      state.x += (target.x - state.x) * 0.09
      state.y += (target.y - state.y) * 0.09
      state.hovering += ((target.hovering ? 1 : 0) - state.hovering) * 0.08
      state.click += (target.click - state.click) * 0.13

      scene.style.setProperty("--pointer-x", state.x.toFixed(4))
      scene.style.setProperty("--pointer-y", state.y.toFixed(4))
      scene.style.setProperty("--hover-amt", state.hovering.toFixed(4))
      scene.style.setProperty("--click-amt", state.click.toFixed(4))

      rafId = window.requestAnimationFrame(animate)
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = scene.getBoundingClientRect()
      const rawX = (event.clientX - rect.left) / rect.width
      const rawY = (event.clientY - rect.top) / rect.height
      const normalizedX = clamp(rawX * 2 - 1, -1, 1)
      const normalizedY = clamp(rawY * 2 - 1, -1, 1)

      targetRef.current = { x: normalizedX, y: normalizedY, hovering: true, click: targetRef.current.click }
    }

    const onPointerEnter = () => {
      targetRef.current.hovering = true
    }

    const onPointerLeave = () => {
      targetRef.current = { x: 0, y: 0, hovering: false, click: targetRef.current.click }
    }

    scene.addEventListener("pointermove", onPointerMove)
    scene.addEventListener("pointerenter", onPointerEnter)
    scene.addEventListener("pointerleave", onPointerLeave)
    rafId = window.requestAnimationFrame(animate)

    return () => {
      scene.removeEventListener("pointermove", onPointerMove)
      scene.removeEventListener("pointerenter", onPointerEnter)
      scene.removeEventListener("pointerleave", onPointerLeave)
      window.cancelAnimationFrame(rafId)
    }
  }, [])

  useEffect(() => {
    startAutoInterval()

    return () => {
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current)
      }
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current)
      }
      clearAutoInterval()
    }
  }, [clearAutoInterval, startAutoInterval])

  const triggerSceneTransition = () => {
    targetRef.current.click = 1
    targetRef.current.hovering = true

    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current)
    }

    clickTimeoutRef.current = window.setTimeout(() => {
      targetRef.current.click = 0
      clickTimeoutRef.current = null
    }, CLICK_PULSE_MS)

    const changed = advanceScene()
    if (changed) {
      startAutoInterval()
    }
  }

  const frontIndex = activeIndex
  const backIndex = (activeIndex + 1) % sceneImages.length

  return (
    <div
      className="hero-dashboard-scene"
      ref={sceneRef}
      role="button"
      tabIndex={0}
      aria-label="Rotate product showcase"
      onClick={triggerSceneTransition}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          triggerSceneTransition()
        }
      }}
    >
      <div className="hero-dashboard-atmosphere hero-dashboard-atmosphere--base" />
      <div className="hero-dashboard-atmosphere hero-dashboard-atmosphere--aura" />
      <div className="hero-dashboard-atmosphere hero-dashboard-atmosphere--vignette" />

      <div className={`hero-dashboard-interactive ${isAnimating ? "is-transitioning" : ""}`}>
        {sceneImages.map((image, index) => {
          const isFront = index === frontIndex
          const isBack = index === backIndex

          return (
            <div
              key={image.key}
              className={`hero-dashboard-surface ${isFront ? "hero-dashboard-surface--front" : ""} ${isBack ? "hero-dashboard-surface--back" : ""}`}
            >
              <figure className={`hero-dashboard-card ${isFront ? "hero-dashboard-card--front" : "hero-dashboard-card--back"}`}>
                <img src={image.src} alt="" loading="eager" decoding="async" className="hero-dashboard-image" />
              </figure>
            </div>
          )
        })}

        <div className="hero-dashboard-cursor-glow" />
        <div className="hero-dashboard-light-band" />
      </div>
    </div>
  )
}
