"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { MoreHorizontal } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { IconButton } from "@/components/ui/icon-button"

export interface PositionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  symbol: string
  type: "buy" | "sell"
  volume: number
  openPrice: number
  currentPrice: number
  profit: number
  profitPercent: number
  onEdit?: () => void
  onClose?: () => void
}

const PositionCard: React.FC<PositionCardProps> = ({
  symbol,
  type,
  volume,
  openPrice,
  currentPrice,
  profit,
  profitPercent,
  onEdit,
  onClose,
  className,
  ...props
}) => {
  const isProfit = profit >= 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Card className={cn("p-4", className)} {...props}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{symbol}</h3>
            <Badge variant={type === "buy" ? "default" : "destructive"} className="uppercase">
              {type}
            </Badge>
          </div>
          <IconButton size="sm" variant="ghost" onClick={onEdit}>
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Volume</div>
            <div className="font-medium price-font">{volume}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Open Price</div>
            <div className="font-medium price-font">{formatCurrency(openPrice, 2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Current Price</div>
            <div className="font-medium price-font">{formatCurrency(currentPrice, 2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">P/L</div>
            <div className={cn("font-bold price-font", isProfit ? "text-profit" : "text-loss")}>
              {isProfit && "+"}
              {formatCurrency(profit, 2)} ({profitPercent.toFixed(2)}%)
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className={cn(
              "mt-3 w-full rounded-md py-2 text-sm font-medium",
              "bg-destructive text-destructive-foreground",
              "hover:bg-destructive/90 transition-colors"
            )}
          >
            Close Position
          </button>
        )}
      </Card>
    </motion.div>
  )
}

export { PositionCard }

