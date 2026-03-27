import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(62,138,118,0.55)] focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm shadow-[rgba(0,0,0,0.25)] hover:bg-[color:rgba(62,138,118,0.9)]",
        secondary:
          "bg-[color:rgba(255,255,255,0.06)] text-foreground ring-1 ring-[color:rgba(255,255,255,0.10)] hover:bg-[color:rgba(255,255,255,0.09)]",
        outline:
          "bg-transparent text-foreground ring-1 ring-[color:rgba(255,255,255,0.12)] hover:bg-[color:rgba(255,255,255,0.05)]",
        ghost: "bg-transparent text-foreground hover:bg-[color:rgba(255,255,255,0.06)]",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3 text-sm",
        lg: "h-11 px-5 text-[0.95rem]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
})

Button.displayName = "Button"

export { Button, buttonVariants }

