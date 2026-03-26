import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

type CloudItem = {
  label: string
}

type RotatingCloudTextProps = {
  items: ReadonlyArray<CloudItem>
  intervalMs?: number
  className?: string
  textClassName?: string
}

export function RotatingCloudText({
  items,
  intervalMs = 3400,
  className,
  textClassName,
}: RotatingCloudTextProps) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const timeoutRef = useRef<number | null>(null)
  const widestLabel = items.reduce(
    (widest, current) => (current.label.length > widest.length ? current.label : widest),
    items[0]?.label ?? ""
  )

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setVisible(false)

      timeoutRef.current = window.setTimeout(() => {
        setIndex((value) => (value + 1) % items.length)
        setVisible(true)
      }, 180)
    }, intervalMs)

    return () => {
      window.clearInterval(intervalId)
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [items.length, intervalMs])

  const activeItem = items[index]

  return (
    <span
      className={cn(
        "relative inline-flex h-[1.12em] min-w-[4.4ch] items-center justify-center align-baseline text-center",
        className
      )}
      aria-live="polite"
    >
      <span
        className={cn(
          "absolute inset-0 inline-flex items-center justify-center whitespace-nowrap text-brand-primary transition-all duration-300 motion-reduce:transition-none",
          textClassName,
          visible
            ? "translate-y-0 opacity-100 motion-reduce:translate-y-0"
            : "translate-y-1 opacity-0 motion-reduce:translate-y-0"
        )}
      >
        <span>{activeItem.label}</span>
      </span>
      <span className="invisible inline-flex w-full items-center justify-center" aria-hidden="true">
        <span>{widestLabel}</span>
      </span>
      <span className="sr-only">{activeItem.label}</span>
    </span>
  )
}
