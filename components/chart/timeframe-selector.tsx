"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface Timeframe {
  id: string
  label: string
  value: string
}

export interface TimeframeSelectorProps extends React.HTMLAttributes<HTMLDivElement> {
  timeframes?: Timeframe[]
  activeTimeframe?: string
  onTimeframeChange?: (timeframeId: string) => void
}

const defaultTimeframes: Timeframe[] = [
  { id: "5y", label: "5y", value: "5y" },
  { id: "1y", label: "1y", value: "1y" },
  { id: "6m", label: "6m", value: "6m" },
  { id: "3m", label: "3m", value: "3m" },
  { id: "1m", label: "1m", value: "1m" },
  { id: "5d", label: "5d", value: "5d" },
  { id: "1d", label: "1d", value: "1d" },
]

const TimeframeSelector: React.FC<TimeframeSelectorProps> = ({
  timeframes = defaultTimeframes,
  activeTimeframe = "1d",
  onTimeframeChange,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex items-center gap-1 p-2 bg-background border-t border-border",
        className
      )}
      {...props}
    >
      <span className="text-xs text-muted-foreground mr-2">Timeframe:</span>
      {timeframes.map((timeframe) => (
        <motion.button
          key={timeframe.id}
          onClick={() => onTimeframeChange?.(timeframe.id)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded transition-colors",
            activeTimeframe === timeframe.id
              ? "bg-primary text-primary-foreground"
              : "hover:bg-accent"
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {timeframe.label}
        </motion.button>
      ))}
    </div>
  )
}

export { TimeframeSelector }

