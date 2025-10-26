// /components/trading/positions-table.tsx

"use client"

import * as React from "react"
import { useAtom } from "jotai"
import { X, MoreVertical, ChevronUp, Edit2, LayersIcon, Layers2Icon } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"
import { Toggle } from "@/components/ui/toggle"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PositionManagementPanel } from "./position-management-panel"
import { Label } from "@/components/ui/label"
import { FlagIcon } from "@/components/data-display/flag-icon"
import {
  positionsActiveTabAtom,
  positionsIsGroupedAtom,
  positionsIsCollapsedAtom,
  positionsColumnsAtom,
  togglePositionColumnAtom
} from "@/lib/store"

export interface Position {
  id: string
  symbol: string
  countryCode?: string
  icon?: string
  type: "Buy" | "Sell"
  volume: number
  openPrice: number
  currentPrice: number
  takeProfit?: number
  stopLoss?: number
  position: string
  openTime: string
  swap: number
  pnl: number
}

export interface PositionsTableProps {
  openPositions: Position[]
  pendingPositions: Position[]
  closedPositions: Position[]
  onClose?: (id: string) => void
  onHide?: () => void
}

const PositionsTable: React.FC<PositionsTableProps> = ({
  // Ensure array props are defensively defaulted to [] to prevent TypeError
  openPositions = [],
  pendingPositions = [],
  closedPositions = [],
  onClose,
}) => {
  const [activeTab, setActiveTab] = useAtom(positionsActiveTabAtom)
  const [isGrouped, setIsGrouped] = useAtom(positionsIsGroupedAtom)
  const [isCollapsed, setIsCollapsed] = useAtom(positionsIsCollapsedAtom)
  const [columns] = useAtom(positionsColumnsAtom)
  const [, toggleColumn] = useAtom(togglePositionColumnAtom)

  const tabs = [
    { id: "open", label: "Open", count: openPositions.length },
    { id: "pending", label: "Pending", count: pendingPositions.length },
    { id: "closed", label: "Closed", count: closedPositions.length },
  ]

  const activeTabIndex = tabs.findIndex(tab => tab.id === activeTab)
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  const [indicatorStyle, setIndicatorStyle] = React.useState({ left: 0, width: 0 })

  // Single scroll container
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [showLeftFade, setShowLeftFade] = React.useState(false)
  const [showRightFade, setShowRightFade] = React.useState(false)

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const scrollLeft = target.scrollLeft
    const scrollWidth = target.scrollWidth
    const clientWidth = target.clientWidth

    // Update fade indicators
    setShowLeftFade(scrollLeft > 20)
    setShowRightFade(scrollLeft + clientWidth < scrollWidth - 20)
  }, [])

  // Check for overflow on mount/data change
  React.useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollWidth, clientWidth } = scrollContainerRef.current
      setShowRightFade(scrollWidth > clientWidth)
    }
  }, [openPositions, pendingPositions, closedPositions, activeTab, columns])

  React.useEffect(() => {
    const activeTabElement = tabRefs.current[activeTabIndex]
    if (activeTabElement) {
      setIndicatorStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      })
    }
  }, [activeTabIndex])

  // ✨ FIX 1: Wrap formatPrice in useCallback
  const formatPrice = React.useCallback((price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })
  }, [])

  // ✨ FIX 2: Wrap renderPositionRow in useCallback to capture 'columns', 'formatPrice', and 'onClose' in its dependencies
  const renderPositionRow = React.useCallback((position: Position) => (
    <TooltipProvider key={position.id} delayDuration={300}>
      <div
        className="grid grid-cols-[minmax(200px,1fr)_80px_90px_100px_100px_90px_90px_100px_150px_90px_100px_90px] gap-4 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 text-sm min-w-max"
      >
      {/* Symbol */}
      {columns.find(c => c.key === "symbol")?.visible && (
        <div className="flex items-center gap-2">
          {position.countryCode && <FlagIcon countryCode={position.countryCode} size="sm" />}
          {position.icon && <span className="text-base">{position.icon}</span>}
          <span className="font-medium text-white">{position.symbol}</span>
        </div>
      )}

      {/* Type */}
      {columns.find(c => c.key === "type")?.visible && (
        <div className="flex items-center">
          <span
            className={cn(
              "px-2 py-0.5 rounded text-xs font-medium",
              position.type === "Buy" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
            )}
          >
            ● {position.type}
          </span>
        </div>
      )}

      {/* Volume */}
      {columns.find(c => c.key === "volume")?.visible && (
        <div className="flex items-center price-font text-white/80">{position.volume}</div>
      )}

      {/* Open Price */}
      {columns.find(c => c.key === "openPrice")?.visible && (
        <div className="flex items-center price-font text-white/80">{formatPrice(position.openPrice)}</div>
      )}

      {/* Current Price */}
      {columns.find(c => c.key === "currentPrice")?.visible && (
        <div className="flex items-center price-font font-medium text-white">{formatPrice(position.currentPrice)}</div>
      )}

      {/* T/P */}
      {columns.find(c => c.key === "tp")?.visible && (
        <div className="flex items-center">
          <Popover>
            <PopoverTrigger asChild>
              {position.takeProfit ? (
                <button
                  className="price-font text-xs text-white/60 hover:text-primary transition-colors underline decoration-dotted"
                >
                  {formatPrice(position.takeProfit)}
                </button>
              ) : (
                <button
                  className="text-xs text-primary hover:text-primary/80 transition-colors underline decoration-dotted"
                >
                  Add
                </button>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side="bottom">
              <PositionManagementPanel
                position={{
                  id: position.id,
                  symbol: position.symbol,
                  countryCode: position.countryCode,
                  icon: position.icon,
                  type: position.type,
                  lots: position.volume,
                  openPrice: position.openPrice,
                  currentPrice: position.currentPrice,
                  takeProfit: position.takeProfit,
                  stopLoss: position.stopLoss,
                  pnl: position.pnl,
                }}
                onClose={() => {}}
                onModify={() => {}}
                onPartialClose={() => {}}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* S/L */}
      {columns.find(c => c.key === "sl")?.visible && (
        <div className="flex items-center">
          <Popover>
            <PopoverTrigger asChild>
              {position.stopLoss ? (
                <button
                  className="price-font text-xs text-white/60 hover:text-primary transition-colors underline decoration-dotted"
                >
                  {formatPrice(position.stopLoss)}
                </button>
              ) : (
                <button
                  className="text-xs text-primary hover:text-primary/80 transition-colors underline decoration-dotted"
                >
                  Add
                </button>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" side="bottom">
              <PositionManagementPanel
                position={{
                  id: position.id,
                  symbol: position.symbol,
                  countryCode: position.countryCode,
                  icon: position.icon,
                  type: position.type,
                  lots: position.volume,
                  openPrice: position.openPrice,
                  currentPrice: position.currentPrice,
                  takeProfit: position.takeProfit,
                  stopLoss: position.stopLoss,
                  pnl: position.pnl,
                }}
                onClose={() => {}}
                onModify={() => {}}
                onPartialClose={() => {}}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Position */}
      {columns.find(c => c.key === "position")?.visible && (
        <div className="flex items-center price-font text-white/80">{position.position}</div>
      )}

      {/* Open Time */}
      {columns.find(c => c.key === "openTime")?.visible && (
        <div className="flex items-center text-white/60 text-xs">{position.openTime}</div>
      )}

      {/* Swap */}
      {columns.find(c => c.key === "swap")?.visible && (
        <div className="flex items-center price-font text-white/80">{position.swap}</div>
      )}

      {/* P/L */}
      {columns.find(c => c.key === "pnl")?.visible && (
        <div className={cn(
          "flex items-center gap-2 price-font font-medium",
          position.pnl >= 0 ? "text-success" : "text-danger"
        )}>
          {position.pnl >= 0 ? "+" : ""}{position.pnl.toFixed(2)}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-1">
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <IconButton
                  size="sm"
                  variant="ghost"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </IconButton>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Modify position</p>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-0" align="end" side="bottom">
            <PositionManagementPanel
              position={{
                id: position.id,
                symbol: position.symbol,
                countryCode: position.countryCode,
                icon: position.icon,
                type: position.type,
                lots: position.volume,
                openPrice: position.openPrice,
                currentPrice: position.currentPrice,
                takeProfit: position.takeProfit,
                stopLoss: position.stopLoss,
                pnl: position.pnl,
              }}
              onClose={() => {}}
              onModify={() => {}}
              onPartialClose={() => {}}
            />
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <IconButton
              size="sm"
              variant="ghost"
              onClick={() => onClose?.(position.id)}
              className="text-danger hover:text-danger/80"
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Close position</p>
          </TooltipContent>
        </Tooltip>
      </div>
      </div>
    </TooltipProvider>
  ), [columns, formatPrice, onClose]) // Dependencies must include everything used inside this function

  return (
    <div className="flex flex-col glass-card rounded-lg overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-6 relative py-3 ">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el
              }}
              onClick={() => {
                setActiveTab(tab.id)
                if (isCollapsed) setIsCollapsed(false)
              }}
              className={cn(
                "text-sm font-medium transition-colors py-2 relative z-10 flex items-center gap-2",
                activeTab === tab.id ? "text-white" : "text-white/60 hover:text-white"
              )}
            >
              {tab.label} {tab.count > 0 && <span className="text-xs bg-white/5 rounded-md text-white/60 h-6 w-6 flex justify-center items-center">{tab.count}</span>}
            </button>
          ))}

          {/* Sliding Indicator */}
          <motion.div
            className="absolute bottom-0 h-0.5 bg-primary"
            initial={false}
            animate={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
            }}
            transition={{
              type: "tween",
              duration: 0.2,
              ease: "easeOut"
            }}
          />
        </div>

        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-2">
            {/* Group/Ungroup Radio Buttons */}
            <div className="flex items-center border border-white/10 rounded-md p-0.5 bg-white/5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsGrouped(false)}
                    className={cn(
                      "p-1.5 rounded transition-colors relative",
                      !isGrouped ? "bg-white/10" : "hover:bg-white/5"
                    )}
                  >
                    <Layers2Icon className="h-4 w-4 text-white/60" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Ungroup</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsGrouped(true)}
                    className={cn(
                      "p-1.5 rounded transition-colors relative",
                      isGrouped ? "bg-white/10" : "hover:bg-white/5"
                    )}
                  >
                    <LayersIcon className="h-4 w-4 text-white/60" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Group</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Column Settings - Three Dots */}
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button className="p-2 rounded-md hover:bg-white/5 transition-colors">
                      <MoreVertical className="h-4 w-4 text-white/60" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Column Settings</p>
                </TooltipContent>
              </Tooltip>
              <PopoverContent className="w-56 p-0" align="end">
                <div className="space-y-1 p-1">
                  <div className="px-2 py-1.5 text-xs font-medium text-white/60">COLUMNS</div>
                  {/* Defensive check for columns.map */}
                  {columns && columns.map((column) => (
                    <div
                      key={column.key}
                      className="flex items-center justify-between px-2 py-1.5 hover:bg-white/5 rounded transition-colors"
                    >
                      <Label htmlFor={column.key} className="text-sm text-white cursor-pointer flex-1">
                        {column.label}
                      </Label>
                      <Toggle
                        id={column.key}
                        checked={column.visible}
                        onCheckedChange={() => toggleColumn(column.key)}
                      />
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Collapse/Expand Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                >
                  {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isCollapsed ? "Expand" : "Collapse"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Table Content - Hidden when collapsed */}
      {!isCollapsed && (
        <div className="relative flex-1 flex flex-col overflow-hidden">
          {/* Left Fade Indicator */}
          <motion.div
            className="absolute top-0 bottom-0 left-0 w-8 pointer-events-none z-10"
            style={{
              background: "linear-gradient(to right, rgba(1, 4, 13, 0.9), transparent)"
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: showLeftFade ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Right Fade Indicator */}
          <motion.div
            className="absolute top-0 bottom-0 right-0 w-8 pointer-events-none z-10"
            style={{
              background: "linear-gradient(to left, rgba(1, 4, 13, 0.9), transparent)"
            }}
            initial={{ opacity: 1 }}
            animate={{ opacity: showRightFade ? 1 : 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Single Scrollable Container */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-auto scrollbar-thin"
            style={{ scrollBehavior: "smooth" }}
          >
            <div className="inline-block min-w-full">
              {/* Table Header */}
              <div className="grid grid-cols-[minmax(200px,1fr)_80px_90px_100px_100px_90px_90px_100px_150px_90px_100px_90px] gap-4 px-4 py-2 bg-white/5 text-xs font-medium text-white/60 border-b border-white/10 sticky top-0 z-10 min-w-max backdrop-blur-xl">
                {/* FIX: columns should now be available in scope */}
                {columns.find(c => c.key === "symbol")?.visible && <div>Symbol</div>}
                {columns.find(c => c.key === "type")?.visible && <div>Type</div>}
                {columns.find(c => c.key === "volume")?.visible && <div>Volume, lot</div>}
                {columns.find(c => c.key === "openPrice")?.visible && <div>Open price</div>}
                {columns.find(c => c.key === "currentPrice")?.visible && <div>Current price</div>}
                {columns.find(c => c.key === "tp")?.visible && <div>T/P</div>}
                {columns.find(c => c.key === "sl")?.visible && <div>S/L</div>}
                {columns.find(c => c.key === "position")?.visible && <div>Position</div>}
                {columns.find(c => c.key === "openTime")?.visible && <div>Open time</div>}
                {columns.find(c => c.key === "swap")?.visible && <div>Swap, USD</div>}
                {columns.find(c => c.key === "pnl")?.visible && <div>P/L, USD</div>}
                <div></div>
              </div>

              {/* Table Rows */}
              <div className="min-w-max">
                {activeTab === "open" && openPositions.map(renderPositionRow)}
                {activeTab === "pending" && pendingPositions.map(renderPositionRow)}
                {activeTab === "closed" && closedPositions.map(renderPositionRow)}

                {/* Empty State */}
                {((activeTab === "open" && openPositions.length === 0) ||
                  (activeTab === "pending" && pendingPositions.length === 0) ||
                  (activeTab === "closed" && closedPositions.length === 0)) && (
                  <div className="flex items-center justify-center h-32 text-white/40 text-sm">
                    No {activeTab} positions
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export { PositionsTable }
