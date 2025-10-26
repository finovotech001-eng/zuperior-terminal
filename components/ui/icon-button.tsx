import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/lib/animations"

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg"
  variant?: "default" | "ghost" | "primary" | "danger"
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", variant = "default", type = "button", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-7 w-7",
      md: "h-9 w-9",
      lg: "h-11 w-11",
    }

    const variantClasses = {
      default: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
      ghost: "hover:bg-white/5 text-white",
      primary: "bg-primary text-white hover:bg-primary/90",
      danger: "bg-danger text-white hover:bg-danger/90",
    }

    return (
      <motion.button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-md",
          "transition-colors focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-50",
          sizeClasses[size],
          variantClasses[variant],
          className
        )}
        variants={buttonVariants}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        {...props}
      />
    )
  }
)
IconButton.displayName = "IconButton"

export { IconButton }
