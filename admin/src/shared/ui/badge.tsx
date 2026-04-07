import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/shared/utils"

const badgeVariants = cva("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-transparent bg-primary text-primary-foreground",
      outline: "border-[color:rgba(15,23,42,0.12)] bg-white text-foreground",
      subtle:
        "border-[color:rgba(47,125,106,0.22)] bg-[color:rgba(47,125,106,0.10)] text-[color:rgba(38,107,90,0.98)]",
      warning:
        "border-[color:rgba(217,119,6,0.26)] bg-[color:rgba(217,119,6,0.10)] text-[color:rgba(146,64,14,0.98)]",
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
