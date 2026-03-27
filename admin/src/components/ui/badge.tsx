import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      outline: "border-[color:rgba(255,255,255,0.14)] bg-[color:rgba(255,255,255,0.04)] text-foreground",
      subtle:
        "border-[color:rgba(118,177,157,0.18)] bg-[color:rgba(62,138,118,0.12)] text-[color:rgba(172,238,214,0.95)]",
      warning:
        "border-[color:rgba(251,191,36,0.22)] bg-[color:rgba(251,191,36,0.10)] text-[color:rgba(253,230,138,0.98)]",
    },
  },
  defaultVariants: {
    variant: "outline",
  },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

