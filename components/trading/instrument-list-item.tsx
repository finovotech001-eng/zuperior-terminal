"use client"

import * as React from "react"
import { Star, GripVertical, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InstrumentColumnConfig } from "@/lib/store"

export interface InstrumentListItemProps {
  symbol: string
  signal: "up" | "down"
  bid: number
  ask: number
  changePercent1d: number
  pnl?: number
  isFavorite?: boolean
  onToggleFavorite?: (e: React.MouseEvent) => void
  onClick?: () => void
  showDragHandle?: boolean
  columns?: InstrumentColumnConfig[]
  className?: string
}

const InstrumentListItem = React.forwardRef<HTMLDivElement, InstrumentListItemProps>(
  (
    {
      symbol,
      signal,
      bid,
      ask,
      changePercent1d,
      pnl,
      isFavorite = false,
      onToggleFavorite,
      onClick,
      showDragHandle = true,
      columns,
      className,
    },
    ref
  ) => {
    const formatPrice = (price: number) => {
      return price.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 5,
      })
    }

    const renderColumnContent = (columnKey: string) => {
      switch (columnKey) {
        case "symbol":
          return (
            <div className="flex items-center gap-1.5 w-full">
              <span className="text-sm font-medium text-white truncate">
                {symbol}
              </span>
            </div>
          )
        case "signal":
          return (
            <div className="flex items-center justify-center w-full">
              {signal === "up" ? (
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-danger" />
              )}
            </div>
          )
        case "bid":
          return (
            <div className="flex items-center justify-end w-full">
              <span className="price-font text-xs text-white">{formatPrice(bid)}</span>
            </div>
          )
        case "ask":
          return (
            <div className="flex items-center justify-end w-full">
              <span className="price-font text-xs text-white">{formatPrice(ask)}</span>
            </div>
          )
        case "change":
          return (
            <div className="flex items-center justify-end w-full">
              <span
                className={cn(
                  "text-xs price-font font-medium",
                  changePercent1d >= 0 ? "text-success" : "text-danger"
                )}
              >
                {changePercent1d >= 0 ? "+" : ""}
                {changePercent1d.toFixed(2)}%
              </span>
            </div>
          )
        case "pnl":
          return (
            <div className="flex items-center justify-end w-full">
              {pnl !== undefined ? (
                <span
                  className={cn(
                    "text-xs price-font font-medium",
                    pnl >= 0 ? "text-success" : "text-danger"
                  )}
                >
                  {pnl >= 0 ? "+" : ""}
                  {pnl.toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-white/40">-</span>
              )}
            </div>
          )
        default:
          return null
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-stretch border-b border-white/5",
          "hover:bg-white/5 cursor-pointer transition-colors group",
          className
        )}
        onClick={onClick}
      >
        {/* Drag Handle (always visible) */}
        {showDragHandle && (
          <div className="flex items-center justify-center w-[28px] shrink-0 cursor-grab active:cursor-grabbing sticky left-0 z-10 backdrop-blur-[7px] bg-white/[0.03] border-r border-white/10 group-hover:bg-white/5 transition-colors">
            <GripVertical className="h-3 w-3 text-white/40 group-hover:text-white/60 transition-colors" />
          </div>
        )}

        {/* Dynamic Columns */}
        {columns?.map((column) => {
          const isSymbol = column.key === "symbol"
          return (
            <div
              key={column.key}
              className={cn(
                "flex items-center px-3 py-2 shrink-0",
                isSymbol && "sticky left-[28px] z-10 backdrop-blur-[7px] bg-white/[0.03] border-r border-white/10 group-hover:bg-white/5 transition-colors"
              )}
              style={{ width: `${column.width}px` }}
            >
              {renderColumnContent(column.key)}
            </div>
          )
        })}

        {/* Star Column (always visible) */}
        <div className="flex items-center justify-center w-[40px] px-2 py-2 shrink-0">
          <button
            onClick={onToggleFavorite}
            className="hover:scale-110 transition-transform"
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                isFavorite
                  ? "fill-warning text-warning"
                  : "text-white/40 hover:text-white/60"
              )}
            />
          </button>
        </div>
      </div>
    )
  }
)

InstrumentListItem.displayName = "InstrumentListItem"

export { InstrumentListItem }

