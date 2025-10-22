import * as React from "react"
import { motion, HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

export interface SpinnerProps extends Omit<HTMLMotionProps<"div">, "animate" | "transition"> {
  size?: "sm" | "md" | "lg"
}

const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = "md", ...props }, ref) => {
    const sizeClasses = {
      sm: "h-4 w-4 border-2",
      md: "h-6 w-6 border-2",
      lg: "h-8 w-8 border-3",
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          "inline-block rounded-full border-solid border-primary",
          "border-t-transparent",
          sizeClasses[size],
          className
        )}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
        {...props}
      />
    )
  }
)
Spinner.displayName = "Spinner"

export { Spinner }

