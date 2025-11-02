"use client"

import * as React from "react"
import { X, Plus, Minus } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Tabs } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { IconButton } from "@/components/ui/icon-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FlagIcon } from "@/components/data-display/flag-icon"
import * as PopoverPrimitive from "@radix-ui/react-popover"

export interface PositionManagementPanelProps {
  position: {
    id: string
    symbol: string
    countryCode?: string
    icon?: string
    type: "Buy" | "Sell"
    lots: number
    openPrice: number
    currentPrice: number
    takeProfit?: number
    stopLoss?: number
    pnl: number
  }
  onClose?: () => void
  onModify?: (data: { takeProfit?: number; stopLoss?: number }) => void
  onPartialClose?: (volume: number) => void
}

const PositionManagementPanel: React.FC<PositionManagementPanelProps> = ({
  position,
  onClose,
  onModify,
  onPartialClose,
}) => {
  // Instrument metadata for correct pip/PnL calculations
  const [digits, setDigits] = React.useState<number>(3)
  const [contractSize, setContractSize] = React.useState<number>(100000)

  // --- Instrument Meta Error State ---
  const [instrumentMetaError, setInstrumentMetaError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const loadMeta = async () => {
      try {
        const params = new URLSearchParams({ search: position.symbol, limit: '1' })
        const res = await fetch(`/apis/instruments?${params.toString()}`, { cache: 'no-store' })
        if (!res.ok) { setInstrumentMetaError(true); return }
        const json = await res.json().catch(() => null as any)
        const item = Array.isArray(json?.data) ? json.data[0] : null
        if (!item) { setInstrumentMetaError(true); return }
        if (!cancelled) {
          setDigits(typeof item.digits === 'number' ? item.digits : 3)
          setContractSize(typeof item.contractSize === 'number' ? item.contractSize : 100000)
          setInstrumentMetaError(false)
        }
      } catch { setInstrumentMetaError(true) }
    }
    loadMeta()
    return () => { cancelled = true }
  }, [position.symbol])
  const [activeTab, setActiveTab] = React.useState("modify")
  const [takeProfitMode, setTakeProfitMode] = React.useState<"price" | "pips" | "money" | "equity">("price")
  const [stopLossMode, setStopLossMode] = React.useState<"price" | "pips" | "money" | "equity">("price")
  
  // Modify Tab State - initialize from position prop
  const [takeProfit, setTakeProfit] = React.useState(() => {
    return (position.takeProfit !== undefined && position.takeProfit !== null && Number(position.takeProfit) > 0) 
      ? position.takeProfit.toString() 
      : ""
  })
  const [stopLoss, setStopLoss] = React.useState(() => {
    return (position.stopLoss !== undefined && position.stopLoss !== null && Number(position.stopLoss) > 0) 
      ? position.stopLoss.toString() 
      : ""
  })
  
  // Sync takeProfit and stopLoss with position prop when it changes
  // This ensures that when SSE updates arrive with modified values, they are displayed
  React.useEffect(() => {
    // Always sync Take Profit if it exists and is valid
    if (position.takeProfit !== undefined && position.takeProfit !== null && Number(position.takeProfit) > 0) {
      const tpStr = position.takeProfit.toString()
      setTakeProfit(prev => {
        if (prev !== tpStr) {
          return tpStr
        }
        return prev
      })
    }
    
    // Always sync Stop Loss if it exists and is valid
    if (position.stopLoss !== undefined && position.stopLoss !== null && Number(position.stopLoss) > 0) {
      const slStr = position.stopLoss.toString()
      setStopLoss(prev => {
        if (prev !== slStr) {
          return slStr
        }
        return prev
      })
    }
  }, [position.takeProfit, position.stopLoss, position.symbol])
  
  // Partial Close Tab State
  const [volumeToClose, setVolumeToClose] = React.useState(position.lots)

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })
  }

  const calculatePips = (targetPrice?: number) => {
    if (!targetPrice) {
      // Default to current price difference
      const pipFactor = Math.pow(10, Math.max(0, Math.min(6, digits || 0)))
      const diff = (position.currentPrice - position.openPrice) * (position.type === "Buy" ? 1 : -1)
      // Divide by 10000000 to normalize (MT5 volume normalization)
      return ((diff * pipFactor) / 10000000).toFixed(1)
    }
    // Calculate pips from openPrice to targetPrice
    const pipFactor = Math.pow(10, Math.max(0, Math.min(6, digits || 0)))
    const diff = (targetPrice - position.openPrice) * (position.type === "Buy" ? 1 : -1)
    // Divide by 10000000 to normalize (MT5 volume normalization)
    return ((diff * pipFactor) / 10000000).toFixed(1)
  }

  const calculateProfitUSD = (targetPrice: number) => {
    // For Buy: profit = (targetPrice - openPrice) * volume * contractSize / 100000
    // For Sell: profit = (openPrice - targetPrice) * volume * contractSize / 100000
    // Divide by 100000 to normalize the calculation (MT5 volume normalization)
    const priceDiff = position.type === "Buy" 
      ? (targetPrice - position.openPrice)
      : (position.openPrice - targetPrice)
    return (priceDiff * position.lots * contractSize) / 100000
  }

  const calculateMaxTakeProfit = () => {
    // For Buy positions, max TP is much higher; for Sell, it's much lower
    // This is a simplified calculation
    return position.type === "Buy" 
      ? (position.currentPrice * 1.05).toFixed(3) 
      : (position.currentPrice * 0.95).toFixed(3)
  }

  const calculateMaxStopLoss = () => {
    // For Buy positions, max SL is lower; for Sell, it's higher
    return position.type === "Buy" 
      ? (position.currentPrice * 0.95).toFixed(3) 
      : (position.currentPrice * 1.05).toFixed(3)
  }

  const safeParseInput = (val: string, fallback: number) => {
    const parsed = parseFloat(val)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const handleModify = async () => {
    const modifyData = {
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
    }
    
    // Update local state immediately with the values we're sending
    // This ensures the UI reflects the changes even before SSE updates
    if (modifyData.takeProfit !== undefined) {
      setTakeProfit(modifyData.takeProfit.toString())
    }
    if (modifyData.stopLoss !== undefined) {
      setStopLoss(modifyData.stopLoss.toString())
    }
    
    // Call the modify handler (async, but we don't wait for it)
    // The panel will stay open so user can see the updated values
    onModify?.(modifyData)
    
    // Don't close the popover here - let the parent handle it after success
    // This allows the user to see the modified values
  }

  const handlePartialClose = () => {
    onPartialClose?.(volumeToClose)
  }

  return (
    <div className="flex flex-col w-[400px] glass-card rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 pt-2">
          {position.countryCode && <FlagIcon countryCode={position.countryCode} size="sm" />}
          {position.icon && <span className="text-base">{position.icon}</span>}
          <span className="font-semibold text-white">{position.symbol}</span>
          <span className="text-sm text-white/60">{position.lots} lots</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <div className={cn(
              "text-base price-font font-semibold",
              position.pnl >= 0 ? "text-[#16A34A]" : "text-[#EF4444]"
            )}>
              {position.pnl >= 0 ? "+" : ""}{position.pnl.toFixed(2)} USD
            </div>
            <div className="flex items-center gap-1 text-xs text-white/60">
              <span className={position.type === "Buy" ? "text-[#16A34A]" : "text-[#EF4444]"}>
                {position.type}
              </span>
              <span>at {formatPrice(position.openPrice)}</span>
            </div>
          </div>
          <PopoverPrimitive.Close asChild>
            <IconButton size="sm" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </IconButton>
          </PopoverPrimitive.Close>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="relative w-full flex border-b border-white/10 shrink-0">
          {["modify", "partial", "closeby"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer",
                activeTab === tab
                  ? "text-white"
                  : "text-white/60 hover:text-white"
              )}
            >
              {tab === "modify" && "Modify"}
              {tab === "partial" && "Partial close"}
              {tab === "closeby" && "Close by"}
            </button>
          ))}
          <motion.div
            className="absolute bottom-0 h-0.5 bg-primary"
            initial={false}
            animate={{
              left: activeTab === "modify" ? "0%" : activeTab === "partial" ? "33.33%" : "66.66%",
              width: "33.33%"
            }}
            transition={{
              type: "tween",
              duration: 0.2,
              ease: "easeOut"
            }}
          />
        </div>

        {/* Modify Tab */}
        <AnimatePresence mode="wait">
          {activeTab === "modify" && (
            <motion.div
              key="modify"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-5 p-5"
            >
              {/* Take Profit */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-white">Take Profit</label>
                <div className="flex items-stretch h-10 border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6] transition-colors">
                  <div className="flex-1 flex items-center pr-2">
                    <Input
                      type="number"
                      step="0.00001"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      placeholder="Not set"
                      className="flex-1 price-font border-0 bg-transparent h-full focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {takeProfit && (
                      <button
                        onClick={() => setTakeProfit("")}
                        className="shrink-0 flex items-center justify-center hover:bg-white/5 rounded p-1 transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5 text-white/40" />
                      </button>
                    )}
                  </div>
                  <div className="w-px bg-white/10"></div>
                  <Select value={takeProfitMode} onValueChange={(value) => setTakeProfitMode(value as "price" | "pips" | "money" | "equity")}>
                    <SelectTrigger className="w-[100px] h-full border-0 bg-transparent rounded-none shadow-none focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="pips">Pips</SelectItem>
                      <SelectItem value="money">Money</SelectItem>
                      <SelectItem value="equity">% Equity</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="w-px bg-white/10"></div>
                  <button
                    onClick={() => {
                      const current = parseFloat(takeProfit) || 0
                      setTakeProfit((current - 0.001).toFixed(3))
                    }}
                    className="w-10 h-full flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Minus className="h-4 w-4 text-white/60" />
                  </button>
                  <button
                    onClick={() => {
                      const current = parseFloat(takeProfit) || position.currentPrice
                      setTakeProfit((current + 0.001).toFixed(3))
                    }}
                    className="w-10 h-full flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-white/60" />
                  </button>
                </div>
                {instrumentMetaError && (
                  <div className="text-xs text-yellow-400 pt-1">Unable to fetch instrument settings for accurate calculation. Defaults used.</div>
                )}
                {(takeProfit || takeProfit === "0") && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-white/60">{calculatePips(safeParseInput(takeProfit, position.openPrice))} pips</span>
                    <span className="text-[#16A34A] price-font font-medium">{(calculateProfitUSD(safeParseInput(takeProfit, position.openPrice)) * 100000).toFixed(2)} USD</span>
                  </div>
                )}
              </div>

              {/* Stop Loss */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-white">Stop Loss</label>
                <div className="flex items-stretch h-10 border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6] transition-colors">
                  <div className="flex-1 flex items-center pr-2">
                    <Input
                      type="number"
                      step="0.00001"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="Not set"
                      className="flex-1 price-font border-0 bg-transparent h-full focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {stopLoss && (
                      <button
                        onClick={() => setStopLoss("")}
                        className="shrink-0 flex items-center justify-center hover:bg-white/5 rounded p-1 transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5 text-white/40" />
                      </button>
                    )}
                  </div>
                  <div className="w-px bg-white/10"></div>
                  <Select value={stopLossMode} onValueChange={(value) => setStopLossMode(value as "price" | "pips" | "money" | "equity")}>
                    <SelectTrigger className="w-[100px] h-full border-0 bg-transparent rounded-none shadow-none focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="price">Price</SelectItem>
                      <SelectItem value="pips">Pips</SelectItem>
                      <SelectItem value="money">Money</SelectItem>
                      <SelectItem value="equity">% Equity</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="w-px bg-white/10"></div>
                  <button
                    onClick={() => {
                      const current = parseFloat(stopLoss) || 0
                      setStopLoss((current - 0.001).toFixed(3))
                    }}
                    className="w-10 h-full flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Minus className="h-4 w-4 text-white/60" />
                  </button>
                  <button
                    onClick={() => {
                      const current = parseFloat(stopLoss) || position.currentPrice
                      setStopLoss((current + 0.001).toFixed(3))
                    }}
                    className="w-10 h-full flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-white/60" />
                  </button>
                </div>
                <div className="text-xs text-[#EF4444]">
                  Max {calculateMaxStopLoss()}
                </div>
                {instrumentMetaError && (
                  <div className="text-xs text-yellow-400 pt-1">Unable to fetch instrument settings for accurate calculation. Defaults used.</div>
                )}
                {(stopLoss || stopLoss === "0") && (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-white/60">{calculatePips(safeParseInput(stopLoss, position.openPrice))} pips</span>
                    <span className="text-[#EF4444] price-font font-medium">{(calculateProfitUSD(safeParseInput(stopLoss, position.openPrice)) * 100000).toFixed(2)} USD</span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={handleModify}
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold rounded-md transition-colors cursor-pointer mt-2"
              >
                Modify position
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Partial Close Tab */}
        {activeTab === "partial" && (
          <motion.div
            key="partial"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-5 p-5"
          >
            <div className="space-y-3">
              <label className="text-sm font-medium text-white">Volume to close</label>
              <div className="flex items-stretch h-10 border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6] transition-colors">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={position.lots}
                  value={volumeToClose}
                  onChange={(e) => setVolumeToClose(parseFloat(e.target.value) || 0.01)}
                  className="flex-1 price-font border-0 bg-transparent h-full focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="w-px bg-white/10"></div>
                <div className="flex items-center justify-center px-3 text-sm text-white/60 min-w-[60px]">
                  Lots
                </div>
                <div className="w-px bg-white/10"></div>
                <button
                  onClick={() => setVolumeToClose(Math.max(0.01, volumeToClose - 0.01))}
                  disabled={volumeToClose <= 0.01}
                  className="w-10 h-full flex items-center justify-center hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Minus className="h-4 w-4 text-white/60" />
                </button>
                <button
                  onClick={() => setVolumeToClose(Math.min(position.lots, volumeToClose + 0.01))}
                  disabled={volumeToClose >= position.lots}
                  className="w-10 h-full flex items-center justify-center hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus className="h-4 w-4 text-white/60" />
                </button>
              </div>
              <div className="text-xs text-white/40">
                Range: {0.01.toFixed(2)} - {position.lots.toFixed(2)} Lots
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handlePartialClose}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold rounded-md transition-colors cursor-pointer mt-2"
            >
              Close position
            </button>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-sm text-white/60">Estimated P/L</span>
              <span className={cn(
                "text-base price-font font-semibold",
                position.pnl >= 0 ? "text-[#16A34A]" : "text-[#EF4444]"
              )}>
                {position.pnl >= 0 ? "+" : ""}{(position.pnl * (volumeToClose / position.lots)).toFixed(2)} USD
              </span>
            </div>
          </motion.div>
        )}

        {/* Close By Tab */}
        {activeTab === "closeby" && (
          <motion.div
            key="closeby"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="text-white font-semibold mb-2">No opposite orders</div>
            <div className="text-sm text-white/60 max-w-xs">
              The &ldquo;Close by&rdquo; feature allows traders to close two hedged orders by cancelling each other out.
            </div>
          </motion.div>
        )}
      </Tabs>
    </div>
  )
}

export { PositionManagementPanel }
