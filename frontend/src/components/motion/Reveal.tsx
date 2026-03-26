import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion"

import { cn } from "@/lib/utils"

type RevealProps = HTMLMotionProps<"div"> & {
  delay?: number
  distance?: number
  once?: boolean
  amount?: number
}

export function Reveal({
  children,
  className,
  delay = 0,
  distance = 20,
  once = true,
  amount = 0.25,
  transition,
  viewport,
  ...props
}: RevealProps) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      className={cn(className)}
      initial={prefersReducedMotion ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: distance, filter: "blur(6px)" }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={viewport ?? { once, amount }}
      transition={
        transition ?? {
          duration: prefersReducedMotion ? 0 : 0.75,
          delay: prefersReducedMotion ? 0 : delay,
          ease: [0.22, 0.61, 0.36, 1],
        }
      }
      {...props}
    >
      {children}
    </motion.div>
  )
}
