import * as React from "react"
import { cn } from "@/shared/utils"

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("kcx-admin-card", className)} {...props} />
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />
}

export function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-[0.95rem] font-semibold tracking-[-0.01em] text-foreground", className)} {...props} />
}

export function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center justify-between gap-3 p-5 pt-0", className)} {...props} />
}
