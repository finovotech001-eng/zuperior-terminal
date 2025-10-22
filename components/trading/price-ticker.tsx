"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn, formatCurrency, formatPercentage } from "@/lib/utils"

export interface PriceTickerProps extends React.HTMLAttributes<HTMLDivElement> {
  symbol: string
  bid: number
  ask: number
  change: number
  changePercent: number
  precision?: number
}

const PriceTicker: React.FC<PriceTickerProps> = ({
  symbol,
  bid,
  ask,
  change,
  changePercent,
  precision = 2,
  className,
  ...props
}) => {
  const isPositive = change >= 0
  const spread = ask - bid

  return (
    <motion.div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg",
        "bg-card border border-border",
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      {...props}
    >
      <div className="flex items-center gap-3">
        <div className="font-semibold text-foreground">{symbol}</div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            Bid: <span className="price-font text-foreground">{formatCurrency(bid, precision)}</span>
          </span>
          <span>|</span>
          <span>
            Ask: <span className="price-font text-foreground">{formatCurrency(ask, precision)}</span>
          </span>
          <span>|</span>
          <span>
            Spread: <span className="price-font">{formatCurrency(spread, precision)}</span>
          </span>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-1 text-sm font-medium",
          isPositive ? "text-profit" : "text-loss"
        )}
      >
        {isPositive ? (
          <TrendingUp className="h-4 w-4" />
        ) : (
          <TrendingDown className="h-4 w-4" />
        )}
        <span className="price-font">
          {formatCurrency(Math.abs(change), precision)} ({formatPercentage(changePercent)})
        </span>
      </div>
    </motion.div>
  )
}

export { PriceTicker }

