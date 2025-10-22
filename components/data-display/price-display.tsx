"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn, formatCurrency } from "@/lib/utils"
import { priceChangeVariants } from "@/lib/animations"

export interface PriceDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  precision?: number
  size?: "sm" | "md" | "lg"
  showAnimation?: boolean
  previousValue?: number
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
  value,
  precision = 2,
  size = "md",
  showAnimation = true,
  previousValue,
  className,
  ...props
}) => {
  const [animationState, setAnimationState] = React.useState<"unchanged" | "up" | "down">("unchanged")

  React.useEffect(() => {
    if (previousValue !== undefined && previousValue !== value) {
      setAnimationState(value > previousValue ? "up" : "down")
      const timer = setTimeout(() => setAnimationState("unchanged"), 300)
      return () => clearTimeout(timer)
    }
  }, [value, previousValue])

  const sizeClasses = {
    sm: "text-sm",
    md: "text-2xl",
    lg: "text-4xl",
  }

  const colorClass =
    animationState === "up"
      ? "text-success"
      : animationState === "down"
      ? "text-danger"
      : "text-white"

  return (
    <motion.div
      className={cn("price-font font-semibold", sizeClasses[size], colorClass, className)}
      variants={showAnimation ? priceChangeVariants : undefined}
      animate={showAnimation ? animationState : undefined}
      {...props}
    >
      {formatCurrency(value, precision)}
    </motion.div>
  )
}

export { PriceDisplay }

