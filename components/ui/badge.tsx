"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { motion } from "framer-motion"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 transition-all duration-200",
  {
    variants: {
      variant: {
        // Default - Flat purple
        default: "bg-primary/20 text-primary border border-primary/20",
        
        // Success - Green for profit
        success: "bg-success/10 text-success border border-success/20",
        
        // Danger - Red for loss
        danger: "bg-danger/10 text-danger border border-danger/20",
        
        // Warning - Amber
        warning: "bg-warning/10 text-warning border border-warning/20",
        
        // Info - Blue
        info: "bg-info/10 text-info border border-info/20",
        
        // Outline - Subtle border
        outline: "border border-white/10 text-white bg-transparent",
        
        // Glass - Glassmorphic
        glass: "glass-card text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  if (asChild) {
    return (
      <Slot
        data-slot="badge"
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    )
  }

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...(props as React.ComponentProps<'span'>)}
    />
  )
}

export { Badge, badgeVariants }
