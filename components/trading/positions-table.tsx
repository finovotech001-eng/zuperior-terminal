// /components/trading/positions-table.tsx

"use client"

import * as React from "react"
import { useAtom } from "jotai"
import { X, MoreVertical, ChevronUp, Edit2, LayersIcon, Layers2Icon } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/icon-button"
import { Button } from "@/components/ui/button"
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
  ticket?: number
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
  accountId?: string | null
  onNotify?: (n: { type: 'success' | 'error'; title?: string; message: string }) => void
}

const PositionsTable: React.FC<PositionsTableProps> = ({
  // Ensure array props are defensively defaulted to [] to prevent TypeError
  openPositions = [],
  pendingPositions = [],
  closedPositions = [],
  onClose,
  accountId,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useAtom(positionsActiveTabAtom)
  const [isGrouped, setIsGrouped] = useAtom(positionsIsGroupedAtom)
  const [isCollapsed, setIsCollapsed] = useAtom(positionsIsCollapsedAtom)
  const [columns] = useAtom(positionsColumnsAtom)
  const [, toggleColumn] = useAtom(togglePositionColumnAtom)
  // Track expanded/collapsed and bulk-close state per group key
  const [expandedGroups, setExpandedGroups] = React.useState<Record<string, boolean>>({})
  const [closingGroups, setClosingGroups] = React.useState<Record<string, boolean>>({})
  const [confirmGroup, setConfirmGroup] = React.useState<PositionGroup | null>(null)
  
  // Track which modify popover is open: positionId_columnKey (e.g., "123_tp", "123_sl", "123_actions")
  const [openModifyPopover, setOpenModifyPopover] = React.useState<string | null>(null)

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

  // Grouping logic for Open positions: group by symbol + type (+ account if provided)
  type PositionGroup = {
    key: string
    symbol: string
    type: Position["type"]
    positions: Position[]
    volume: number
    pnl: number
    swap: number
    openPrice: number // weighted by volume
    currentPrice: number // use first (same for symbol)
    countryCode?: string
    icon?: string
  }

  // Detect if there are duplicates to auto-enable grouping UX
  const hasDuplicateGroups = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of openPositions || []) {
      const key = `${p.symbol}__${p.type}`
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    for (const v of counts.values()) if (v > 1) return true
    return false
  }, [openPositions])

  // Respect user's explicit grouping preference via toggle
  const shouldGroupOpen = isGrouped

  const groupedOpenPositions = React.useMemo<PositionGroup[]>(() => {
    if (!shouldGroupOpen) return []
    const map = new Map<string, PositionGroup>()
    for (const p of openPositions || []) {
      const key = `${p.symbol}__${p.type}`
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          key,
          symbol: p.symbol,
          type: p.type,
          positions: [p],
          volume: p.volume ?? 0,
          pnl: p.pnl ?? 0,
          swap: p.swap ?? 0,
          openPrice: (p.openPrice ?? 0) * (p.volume ?? 0),
          currentPrice: p.currentPrice ?? 0,
          countryCode: p.countryCode,
          icon: p.icon,
        })
      } else {
        existing.positions.push(p)
        existing.volume += p.volume ?? 0
        existing.pnl += p.pnl ?? 0
        existing.swap += p.swap ?? 0
        existing.openPrice += (p.openPrice ?? 0) * (p.volume ?? 0)
        // currentPrice is the same per symbol; keep first
      }
    }
    // finalize weighted open price
    const list = Array.from(map.values()).map(g => ({
      ...g,
      openPrice: g.volume > 0 ? g.openPrice / g.volume : 0,
    }))
    return list
  }, [shouldGroupOpen, openPositions])

  const toggleGroupExpanded = React.useCallback((key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // ✨ FIX 2: Wrap renderPositionRow in useCallback to capture 'columns', 'formatPrice', and 'onClose' in its dependencies
  const renderPositionRow = React.useCallback((position: Position, index?: number) => {
    
    // For closed positions, hide T/P, S/L, and Actions columns
    const isClosedPosition = position.id?.startsWith('hist-')
    
    return (
    <TooltipProvider key={position.id} delayDuration={300}>
      <div
        className={`grid gap-1 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 text-sm min-w-max ${
          isClosedPosition
            ? "grid-cols-[minmax(180px,1fr)_65px_90px_100px_100px_150px_90px_100px_100px]" // Without T/P, S/L, Actions - P/L at end
            : "grid-cols-[minmax(180px,1fr)_65px_90px_100px_100px_90px_90px_100px_150px_90px_100px_90px]" // Full columns
        }`}
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
        <div className="flex items-center price-font text-white/80">{position.volume.toFixed(2)}</div>
      )}

      {/* Open Price */}
      {columns.find(c => c.key === "openPrice")?.visible && (
        <div className="flex items-center price-font text-white/80">{formatPrice(position.openPrice)}</div>
      )}

      {/* Current Price */}
      {columns.find(c => c.key === "currentPrice")?.visible && (
        <div className="flex items-center price-font font-medium text-white">{formatPrice(position.currentPrice)}</div>
      )}

      {/* T/P - Hidden for closed positions */}
      {columns.find(c => c.key === "tp")?.visible && !isClosedPosition && (
        <div className="flex items-center">
          <Popover 
            open={openModifyPopover === `${position.id}_tp`} 
            onOpenChange={(open) => setOpenModifyPopover(open ? `${position.id}_tp` : null)}
          >
            <PopoverTrigger asChild>
              {position.takeProfit !== undefined && position.takeProfit !== null && Number(position.takeProfit) > 0 ? (
                <button
                  className="price-font text-xs text-white/60 hover:text-primary transition-colors underline decoration-dotted"
                  title={`Take Profit: ${formatPrice(position.takeProfit)}`}
                  onMouseEnter={() => {
                    // Prefetch instrument metadata on hover for instant calculation when panel opens
                    const cached = localStorage.getItem(`instrument_meta_${position.symbol}`)
                    if (!cached || (JSON.parse(cached)?.timestamp && Date.now() - JSON.parse(cached).timestamp > 5 * 60 * 1000)) {
                      fetch(`/apis/instruments?${new URLSearchParams({ search: position.symbol, limit: '1' }).toString()}`, { cache: 'no-store' })
                        .then(res => res.json())
                        .then(json => {
                          const item = Array.isArray(json?.data) ? json.data[0] : null
                          if (item) {
                            localStorage.setItem(`instrument_meta_${position.symbol}`, JSON.stringify({
                              timestamp: Date.now(),
                              data: { digits: item.digits || 3, contractSize: item.contractSize || 100000 }
                            }))
                          }
                        })
                        .catch(() => {})
                    }
                  }}
                >
                  {formatPrice(position.takeProfit)}
                </button>
              ) : (
                <button
                  className="text-xs text-primary hover:text-primary/80 transition-colors underline decoration-dotted"
                  title="Click to set Take Profit"
                  onMouseEnter={() => {
                    // Prefetch instrument metadata on hover for instant calculation when panel opens
                    const cached = localStorage.getItem(`instrument_meta_${position.symbol}`)
                    if (!cached || (JSON.parse(cached)?.timestamp && Date.now() - JSON.parse(cached).timestamp > 5 * 60 * 1000)) {
                      fetch(`/apis/instruments?${new URLSearchParams({ search: position.symbol, limit: '1' }).toString()}`, { cache: 'no-store' })
                        .then(res => res.json())
                        .then(json => {
                          const item = Array.isArray(json?.data) ? json.data[0] : null
                          if (item) {
                            localStorage.setItem(`instrument_meta_${position.symbol}`, JSON.stringify({
                              timestamp: Date.now(),
                              data: { digits: item.digits || 3, contractSize: item.contractSize || 100000 }
                            }))
                          }
                        })
                        .catch(() => {})
                    }
                  }}
                >
                  Modify
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
                onClose={() => setOpenModifyPopover(null)}
                onModify={async (data) => {
                  try {
                    const direct = Number(position.ticket)
                    const ticketStr = position.position || position.id
                    const ticketFromText = parseInt(ticketStr.replace(/[^0-9]/g, ''), 10)
                    const ticket = Number.isFinite(direct) && direct > 0 ? direct : (Number.isFinite(ticketFromText) && ticketFromText > 0 ? ticketFromText : NaN)
                    if (!accountId || !Number.isFinite(ticket)) {
                      return
                    }
                    // Acquire access token so server can skip DB auth
                    let accessToken: string | undefined = undefined
                    try {
                      const authRes = await fetch('/apis/auth/mt5-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accountId })
                      })
                      const authJson = await authRes.json().catch(() => ({} as any))
                      if (authRes.ok && authJson?.data?.accessToken) accessToken = authJson.data.accessToken
                    } catch {}

                    const payload: any = {
                      accountId,
                      positionId: ticket,
                      comment: `Modify TP/SL via table for ${position.symbol}`,
                      ...(accessToken ? { accessToken } : {}),
                    }
                    if (data.stopLoss !== undefined) payload.stopLoss = data.stopLoss
                    if (data.takeProfit !== undefined) payload.takeProfit = data.takeProfit
                    
                    const res = await fetch('/apis/trading/position/modify', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    })
                    
                    const text = await res.text().catch(() => '')
                    
                    let json: any = null
                    try { 
                      json = text ? JSON.parse(text) : null
                    } catch (e) { 
                      json = text 
                    }
                    
                    // Check for success: status: true, success: true, or json?.data?.status === true
                    // Also check for HTTP 200-299 status codes
                    const isSuccess = res.ok && (
                      json?.status === true || 
                      json?.success === true || 
                      json?.data?.status === true || 
                      json?.data?.success === true ||
                      (res.status >= 200 && res.status < 300 && json && !json.error && !json.message?.includes('error'))
                    )
                    
                    if (isSuccess) {
                      // Build detailed message showing what was modified
                      const modifiedParts: string[] = []
                      if (data.takeProfit !== undefined) {
                        modifiedParts.push(`TP: ${data.takeProfit.toLocaleString('en-US', { maximumFractionDigits: 5 })}`)
                      }
                      if (data.stopLoss !== undefined) {
                        modifiedParts.push(`SL: ${data.stopLoss.toLocaleString('en-US', { maximumFractionDigits: 5 })}`)
                      }
                      const detailMsg = modifiedParts.length > 0 
                        ? `${position.symbol} - ${modifiedParts.join(', ')}`
                        : `${position.symbol} position modified`
                      try { onNotify?.({ type: 'success', title: 'Position modified', message: detailMsg }) } catch {}
                      // Keep popover open for a moment so user can see the updated values
                      // Close after a short delay to allow user to see the changes
                      setTimeout(() => {
                        setOpenModifyPopover(null);
                      }, 2000); // Close after 2 seconds
                      // Don't call onClose here - it would close the position!
                      // The positions will refresh automatically via SSE/polling
                    } else {
                      const errorMsg = json?.message || json?.error || json?.data?.message || `HTTP ${res.status}: ${res.statusText}`
                      try { onNotify?.({ type: 'error', title: 'Modify failed', message: String(errorMsg) }) } catch {}
                      // Keep modal open on error so user can see/retry
                    }
                  } catch (e) {
                    try { onNotify?.({ type: 'error', title: 'Modify failed', message: e instanceof Error ? e.message : 'Unknown error' }) } catch {}
                    // Keep modal open on exception
                  }
                }}
                onPartialClose={() => {}}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* S/L - Hidden for closed positions */}
      {columns.find(c => c.key === "sl")?.visible && !isClosedPosition && (
        <div className="flex items-center">
          <Popover 
            open={openModifyPopover === `${position.id}_sl`} 
            onOpenChange={(open) => setOpenModifyPopover(open ? `${position.id}_sl` : null)}
          >
            <PopoverTrigger asChild>
              {position.stopLoss !== undefined && position.stopLoss !== null && Number(position.stopLoss) > 0 ? (
                <button
                  className="price-font text-xs text-white/60 hover:text-primary transition-colors underline decoration-dotted"
                  title={`Stop Loss: ${formatPrice(position.stopLoss)}`}
                  onMouseEnter={() => {
                    // Prefetch instrument metadata on hover for instant calculation when panel opens
                    const cached = localStorage.getItem(`instrument_meta_${position.symbol}`)
                    if (!cached || (JSON.parse(cached)?.timestamp && Date.now() - JSON.parse(cached).timestamp > 5 * 60 * 1000)) {
                      fetch(`/apis/instruments?${new URLSearchParams({ search: position.symbol, limit: '1' }).toString()}`, { cache: 'no-store' })
                        .then(res => res.json())
                        .then(json => {
                          const item = Array.isArray(json?.data) ? json.data[0] : null
                          if (item) {
                            localStorage.setItem(`instrument_meta_${position.symbol}`, JSON.stringify({
                              timestamp: Date.now(),
                              data: { digits: item.digits || 3, contractSize: item.contractSize || 100000 }
                            }))
                          }
                        })
                        .catch(() => {})
                    }
                  }}
                >
                  {formatPrice(position.stopLoss)}
                </button>
              ) : (
                <button
                  className="text-xs text-primary hover:text-primary/80 transition-colors underline decoration-dotted"
                  title="Click to set Stop Loss"
                  onMouseEnter={() => {
                    // Prefetch instrument metadata on hover for instant calculation when panel opens
                    const cached = localStorage.getItem(`instrument_meta_${position.symbol}`)
                    if (!cached || (JSON.parse(cached)?.timestamp && Date.now() - JSON.parse(cached).timestamp > 5 * 60 * 1000)) {
                      fetch(`/apis/instruments?${new URLSearchParams({ search: position.symbol, limit: '1' }).toString()}`, { cache: 'no-store' })
                        .then(res => res.json())
                        .then(json => {
                          const item = Array.isArray(json?.data) ? json.data[0] : null
                          if (item) {
                            localStorage.setItem(`instrument_meta_${position.symbol}`, JSON.stringify({
                              timestamp: Date.now(),
                              data: { digits: item.digits || 3, contractSize: item.contractSize || 100000 }
                            }))
                          }
                        })
                        .catch(() => {})
                    }
                  }}
                >
                  Modify
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
                onClose={() => setOpenModifyPopover(null)}
                onModify={async (data) => {
                  try {
                    const direct = Number(position.ticket)
                    const ticketStr = position.position || position.id
                    const ticketFromText = parseInt(ticketStr.replace(/[^0-9]/g, ''), 10)
                    const ticket = Number.isFinite(direct) && direct > 0 ? direct : (Number.isFinite(ticketFromText) && ticketFromText > 0 ? ticketFromText : NaN)
                    if (!accountId || !Number.isFinite(ticket)) {
                      return
                    }
                    // Acquire access token so server can skip DB auth
                    let accessToken: string | undefined = undefined
                    try {
                      const authRes = await fetch('/apis/auth/mt5-login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accountId })
                      })
                      const authJson = await authRes.json().catch(() => ({} as any))
                      if (authRes.ok && authJson?.data?.accessToken) accessToken = authJson.data.accessToken
                    } catch {}

                    const payload: any = {
                      accountId,
                      positionId: ticket,
                      comment: `Modify TP/SL via table for ${position.symbol}`,
                      ...(accessToken ? { accessToken } : {}),
                    }
                    if (data.stopLoss !== undefined) payload.stopLoss = data.stopLoss
                    if (data.takeProfit !== undefined) payload.takeProfit = data.takeProfit
                    
                    const res = await fetch('/apis/trading/position/modify', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload),
                    })
                    
                    const text = await res.text().catch(() => '')
                    
                    let json: any = null
                    try { 
                      json = text ? JSON.parse(text) : null
                    } catch (e) { 
                      json = text 
                    }
                    
                    // Check for success: status: true, success: true, or json?.data?.status === true
                    // Also check for HTTP 200-299 status codes
                    const isSuccess = res.ok && (
                      json?.status === true || 
                      json?.success === true || 
                      json?.data?.status === true || 
                      json?.data?.success === true ||
                      (res.status >= 200 && res.status < 300 && json && !json.error && !json.message?.includes('error'))
                    )
                    
                    if (isSuccess) {
                      try { onNotify?.({ type: 'success', title: 'Position modified', message: `Updated TP/SL for ${position.symbol}` }) } catch {}
                      // Keep popover open for a moment so user can see the updated values
                      // Close after a short delay to allow user to see the changes
                      setTimeout(() => {
                        setOpenModifyPopover(null);
                      }, 2000); // Close after 2 seconds
                      // Don't call onClose here - it would close the position!
                      // The positions will refresh automatically via SSE/polling
                    } else {
                      const errorMsg = json?.message || json?.error || json?.data?.message || `HTTP ${res.status}: ${res.statusText}`
                      try { onNotify?.({ type: 'error', title: 'Modify failed', message: String(errorMsg) }) } catch {}
                      // Keep modal open on error so user can see/retry
                    }
                  } catch (e) {
                    try { onNotify?.({ type: 'error', title: 'Modify failed', message: e instanceof Error ? e.message : 'Unknown error' }) } catch {}
                    // Keep modal open on exception
                  }
                }}
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

      {/* Actions - Hidden for closed positions */}
      {!isClosedPosition && (
      <div className="flex items-center justify-center gap-1" style={{ position: 'relative', zIndex: 10 }}>
        <Popover 
          open={openModifyPopover === `${position.id}_actions`} 
          onOpenChange={(open) => setOpenModifyPopover(open ? `${position.id}_actions` : null)}
        >
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
              onClose={() => setOpenModifyPopover(null)}
              onModify={async (data) => {
                try {
                  const direct = Number(position.ticket)
                  const ticketStr = position.position || position.id
                  const ticketFromText = parseInt((ticketStr || '').replace(/[^0-9]/g, ''), 10)
                    const ticket = Number.isFinite(direct) && direct > 0 ? direct : (Number.isFinite(ticketFromText) && ticketFromText > 0 ? ticketFromText : NaN)
                    if (!accountId || !Number.isFinite(ticket)) {
                      return
                    }
                  // Acquire access token so server can skip DB auth
                  let accessToken: string | undefined = undefined
                  try {
                    const authRes = await fetch('/apis/auth/mt5-login', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ accountId })
                    })
                    const authJson = await authRes.json().catch(() => ({} as any))
                    if (authRes.ok && authJson?.data?.accessToken) accessToken = authJson.data.accessToken
                  } catch {}

                  const payload: any = {
                    accountId,
                    positionId: ticket,
                    comment: `Modify TP/SL via actions for ${position.symbol}`,
                    ...(accessToken ? { accessToken } : {}),
                  }
                  if (data.stopLoss !== undefined) payload.stopLoss = data.stopLoss
                  if (data.takeProfit !== undefined) payload.takeProfit = data.takeProfit
                  
                  const res = await fetch('/apis/trading/position/modify', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  })
                  
                  const text = await res.text().catch(() => '')
                  
                  let json: any = null
                  try { 
                    json = text ? JSON.parse(text) : null
                  } catch (e) { 
                    json = text 
                  }
                  
                  // Check for success: status: true, success: true, or json?.data?.status === true
                  // Also check for HTTP 200-299 status codes
                  const isSuccess = res.ok && (
                    json?.status === true || 
                    json?.success === true || 
                    json?.data?.status === true || 
                    json?.data?.success === true ||
                    (res.status >= 200 && res.status < 300 && json && !json.error && !json.message?.includes('error'))
                  )
                  
                    if (isSuccess) {
                      // Build detailed message showing what was modified
                      const modifiedParts: string[] = []
                      if (data.takeProfit !== undefined) {
                        modifiedParts.push(`TP: ${data.takeProfit.toLocaleString('en-US', { maximumFractionDigits: 5 })}`)
                      }
                      if (data.stopLoss !== undefined) {
                        modifiedParts.push(`SL: ${data.stopLoss.toLocaleString('en-US', { maximumFractionDigits: 5 })}`)
                      }
                      const detailMsg = modifiedParts.length > 0 
                        ? `${position.symbol} - ${modifiedParts.join(', ')}`
                        : `${position.symbol} position modified`
                      try { onNotify?.({ type: 'success', title: 'Position modified', message: detailMsg }) } catch {}
                      // Keep popover open for a moment so user can see the updated values
                      // Close after a short delay to allow user to see the changes
                      setTimeout(() => {
                        setOpenModifyPopover(null);
                      }, 2000); // Close after 2 seconds
                    } else {
                      const errorMsg = json?.message || json?.error || json?.data?.message || `HTTP ${res.status}: ${res.statusText}`
                      try { onNotify?.({ type: 'error', title: 'Modify failed', message: String(errorMsg) }) } catch {}
                      // Keep modal open on error so user can see/retry
                    }
                } catch (e) {
                  try { onNotify?.({ type: 'error', title: 'Modify failed', message: e instanceof Error ? e.message : 'Unknown error' }) } catch {}
                  // Keep modal open on exception
                }
              }}
              onPartialClose={() => {}}
            />
          </PopoverContent>
        </Popover>
        <button
          type="button"
          title="Close position"
          onClick={() => {
            if (onClose) {
              onClose(position.id);
            }
          }}
          className="inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-7 w-7 hover:bg-white/5 text-danger hover:text-danger/80 cursor-pointer border-0 bg-transparent"
          style={{ position: 'relative', zIndex: 9999 }}
        >
          <X className="h-3.5 w-3.5 pointer-events-none" />
        </button>
      </div>
      )}
      </div>
    </TooltipProvider>
    )
  }, [columns, formatPrice, onClose, activeTab]) // Dependencies must include everything used inside this function

  // Renderer for grouped parent row (collapsed/expanded control)
  const renderGroupRow = React.useCallback((group: PositionGroup) => {
    const isExpanded = !!expandedGroups[group.key]
    const pnlPositive = (group.pnl ?? 0) >= 0
    return (
      <div key={`group-${group.key}`} className="border-b border-white/5">
        <div
          className={cn(
            "grid gap-1 px-4 py-3 hover:bg-white/5 transition-colors text-sm min-w-max cursor-pointer",
            // Use the open tab columns layout (full columns)
            "grid-cols-[minmax(180px,1fr)_65px_90px_100px_100px_90px_90px_100px_150px_90px_100px_90px]"
          )}
          onClick={() => toggleGroupExpanded(group.key)}
        >
          {/* Symbol with count badge and chevron */}
          {columns.find(c => c.key === "symbol")?.visible && (
            <div className="flex items-center gap-2">
              <ChevronUp className={cn("h-4 w-4 text-white/60 transition-transform", isExpanded ? "rotate-0" : "-rotate-180")} />
              {group.countryCode && <FlagIcon countryCode={group.countryCode} size="sm" />}
              {group.icon && <span className="text-base">{group.icon}</span>}
              <span className="font-medium text-white">{group.symbol}</span>
              <span className="ml-2 text-xs bg-white/5 rounded-md text-white/60 h-5 px-2 inline-flex items-center justify-center">{group.positions.length}</span>
            </div>
          )}

          {/* Type */}
          {columns.find(c => c.key === "type")?.visible && (
            <div className="flex items-center">
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  group.type === "Buy" ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                )}
              >
                ● {group.type}
              </span>
            </div>
          )}

          {/* Volume (sum) */}
          {columns.find(c => c.key === "volume")?.visible && (
            <div className="flex items-center price-font text-white/80">{(group.volume ?? 0).toFixed(2)}</div>
          )}

          {/* Open Price (weighted) */}
          {columns.find(c => c.key === "openPrice")?.visible && (
            <div className="flex items-center price-font text-white/80">{formatPrice(group.openPrice ?? 0)}</div>
          )}

          {/* Current Price */}
          {columns.find(c => c.key === "currentPrice")?.visible && (
            <div className="flex items-center price-font font-medium text-white">{formatPrice(group.currentPrice ?? 0)}</div>
          )}

          {/* T/P */}
          {columns.find(c => c.key === "tp")?.visible && (
            <div className="flex items-center text-xs text-white/40">—</div>
          )}

          {/* S/L */}
          {columns.find(c => c.key === "sl")?.visible && (
            <div className="flex items-center text-xs text-white/40">—</div>
          )}

          {/* Position (show range or first-last) */}
          {columns.find(c => c.key === "position")?.visible && (
            <div className="flex items-center price-font text-white/80">
              {group.positions[0]?.position}
            </div>
          )}

          {/* Open Time (first) */}
          {columns.find(c => c.key === "openTime")?.visible && (
            <div className="flex items-center text-white/60 text-xs">{group.positions[0]?.openTime}</div>
          )}

          {/* Swap (sum) */}
          {columns.find(c => c.key === "swap")?.visible && (
            <div className="flex items-center price-font text-white/80">{formatPrice(group.swap ?? 0)}</div>
          )}

          {/* P/L (sum) */}
          {columns.find(c => c.key === "pnl")?.visible && (
            <div className={cn("flex items-center price-font font-medium", pnlPositive ? "text-success" : "text-danger")}>{pnlPositive ? "+" : ""}{formatPrice(group.pnl ?? 0)}</div>
          )}

          {/* Actions column: Close all in group */}
          <div className="flex items-center justify-end">
            <Popover
              open={confirmGroup?.key === group.key}
              onOpenChange={(open) => {
                // Prevent row toggle; just manage confirmation popover state
                setConfirmGroup(open ? group : null)
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Close all positions in this group"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!onClose) return
                    setConfirmGroup(group)
                  }}
                  disabled={!!closingGroups[group.key]}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 h-7 w-7 border-0 bg-transparent",
                    closingGroups[group.key]
                      ? "opacity-50 cursor-not-allowed text-danger"
                      : "hover:bg-white/5 text-danger hover:text-danger/80 cursor-pointer"
                  )}
                >
                  <X className={cn("h-3.5 w-3.5 pointer-events-none", closingGroups[group.key] ? "animate-pulse" : undefined)} />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" alignOffset={4} className="w-[360px] p-4 bg-[#1b1f2a] border-white/10 shadow-xl">
                <div className="text-white font-medium mb-3">
                  Close all {group.symbol} positions at the market price?
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setConfirmGroup(null)}>Cancel</Button>
                  <Button
                    variant="default"
                    className="bg-primary hover:bg-primary/90 text-white"
                    onClick={async () => {
                      if (!onClose) return
                      const key = group.key
                      setClosingGroups(prev => ({ ...prev, [key]: true }))
                      setConfirmGroup(null)
                      const results = await Promise.allSettled(group.positions.map(p => Promise.resolve(onClose(p.id))))
                      const ok = results.filter(r => r.status === 'fulfilled').length
                      const failed = results.length - ok
                      try { onNotify?.({ type: failed > 0 ? 'error' : 'success', title: failed > 0 ? 'Close all finished' : 'Positions closed', message: `${ok} of ${results.length} positions closed${failed>0?` (${failed} failed)`:''}` }) } catch {}
                      setClosingGroups(prev => ({ ...prev, [key]: false }))
                    }}
                  >
                    Confirm
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Children */}
        {isExpanded && group.positions.map(p => renderPositionRow(p))}
      </div>
    )
  }, [columns, expandedGroups, formatPrice, renderPositionRow, toggleGroupExpanded, onClose])

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
              <div className={`grid gap-1 px-4 py-2 bg-white/5 text-xs font-medium text-white/60 border-b border-white/10 sticky top-0 z-10 min-w-max backdrop-blur-xl ${
                activeTab === "closed" 
                  ? "grid-cols-[minmax(180px,1fr)_65px_90px_100px_100px_150px_90px_100px_100px]" // Without T/P, S/L, Actions - P/L at end
                  : "grid-cols-[minmax(180px,1fr)_65px_90px_100px_100px_90px_90px_100px_150px_90px_100px_90px]" // Full columns
              }`}>
                {columns.find(c => c.key === "symbol")?.visible && <div>Symbol</div>}
                {columns.find(c => c.key === "type")?.visible && <div>Type</div>}
                {columns.find(c => c.key === "volume")?.visible && <div>Volume</div>}
                {columns.find(c => c.key === "openPrice")?.visible && (
                  <div>{activeTab === "pending" ? "Price Order" : "Open price"}</div>
                )}
                {columns.find(c => c.key === "currentPrice")?.visible && <div>Current price</div>}
                {columns.find(c => c.key === "tp")?.visible && activeTab !== "closed" && <div>T/P</div>}
                {columns.find(c => c.key === "sl")?.visible && activeTab !== "closed" && <div>S/L</div>}
                {columns.find(c => c.key === "position")?.visible && <div>Position</div>}
                {columns.find(c => c.key === "openTime")?.visible && <div>Open time</div>}
                {columns.find(c => c.key === "swap")?.visible && <div>Swap, USD</div>}
                {columns.find(c => c.key === "pnl")?.visible && <div>P/L, USD</div>}
                {activeTab !== "closed" && <div></div>}
              </div>

              {/* Table Rows */}
              <div className="min-w-max">
                {activeTab === "open" && !shouldGroupOpen && openPositions.length > 0 && openPositions.map(renderPositionRow)}
                {activeTab === "open" && shouldGroupOpen && groupedOpenPositions.length > 0 && groupedOpenPositions.map(renderGroupRow)}
                {activeTab === "pending" && pendingPositions.length > 0 && pendingPositions.map(renderPositionRow)}
                {activeTab === "closed" && closedPositions.length > 0 && closedPositions.map((pos, idx) => {
                  return renderPositionRow(pos, idx)
                })}

                {/* Empty State */}
                {((activeTab === "open" && ((shouldGroupOpen && groupedOpenPositions.length === 0) || (!shouldGroupOpen && openPositions.length === 0))) ||
                  (activeTab === "pending" && pendingPositions.length === 0) ||
                  (activeTab === "closed" && closedPositions.length === 0)) && (
                  <div className="flex flex-col items-center justify-center h-32 text-white/40 text-sm gap-2">
                    <div>No {activeTab} positions</div>
                    {activeTab === "closed" && (
                      <div className="text-xs text-white/20">Check browser console for debugging info</div>
                    )}
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
