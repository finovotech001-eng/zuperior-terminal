"use client"

import * as React from "react"
import { X, Plus, Minus, HelpCircle } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FlagIcon } from "@/components/data-display/flag-icon"
import { useTickPrice } from "@/hooks/useWebSocket"

export interface OrderPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  symbol?: string
  countryCode?: string
  icon?: string
  sellPrice?: number
  buyPrice?: number
  spread?: string
  onClose?: () => void
  onBuy?: (data: OrderData) => void
  onSell?: (data: OrderData) => void
  activeInstrument?: {
    symbol: string
    bid?: number
    ask?: number
    [key: string]: unknown
  }
}

export interface OrderData {
  orderType: "market" | "pending" | "limit"
  volume: number
  openPrice?: number
  stopLoss?: number
  takeProfit?: number
  risk?: number
}

type FormType = "one-click" | "regular" | "risk-calculator"

const OrderPanel: React.FC<OrderPanelProps> = ({
  symbol = "XAU/USD",
  countryCode = "US",
  sellPrice = 4354.896,
  buyPrice = 4355.056,
  spread = "0.16 USD",
  onClose,
  onBuy,
  onSell,
  className,
  ...props
}) => {
  // Get real-time prices from WebSocket
  const { bid, ask, spread: liveSpread, isSubscribed } = useTickPrice(symbol)
  
  // Use live prices if available, otherwise fall back to props
  const currentSellPrice = bid ?? sellPrice
  const currentBuyPrice = ask ?? buyPrice
  const currentSpread = liveSpread !== undefined ? `${liveSpread.toFixed(2)} pips` : spread
  
  const [formType, setFormType] = React.useState<FormType>("regular")
  const [orderType, setOrderType] = React.useState<"market" | "limit" | "pending">("market")
  const [volume, setVolume] = React.useState("1")
  const [risk, setRisk] = React.useState("")
  const [riskMode, setRiskMode] = React.useState<"usd" | "percent">("usd")
  const [takeProfit, setTakeProfit] = React.useState("")
  const [takeProfitMode, setTakeProfitMode] = React.useState<"pips" | "price">("price")
  const [stopLoss, setStopLoss] = React.useState("")
  const [stopLossMode, setStopLossMode] = React.useState<"pips" | "price">("price")
  const [volumePercentage] = React.useState(21)
  const [openPrice, setOpenPrice] = React.useState("")
  const [showMoreInfo, setShowMoreInfo] = React.useState(false)

  // Update dropdown modes when form type changes
  React.useEffect(() => {
    if (formType === "regular") {
      setTakeProfitMode("price")
      setStopLossMode("price")
    } else if (formType === "risk-calculator") {
      setTakeProfitMode("pips")
      setStopLossMode("pips")
      setRiskMode("usd")
    }
  }, [formType])

  const handleVolumeChange = (value: string) => {
    setVolume(value)
  }

  const incrementVolume = () => {
    const currentValue = parseFloat(volume) || 0
    setVolume((currentValue + 0.01).toFixed(2))
  }

  const decrementVolume = () => {
    const currentValue = parseFloat(volume) || 0
    if (currentValue > 0.01) {
      setVolume((currentValue - 0.01).toFixed(2))
    }
  }

  const incrementField = (value: string, setter: (v: string) => void) => {
    const currentValue = parseFloat(value) || 0
    setter((currentValue + 0.001).toFixed(3))
  }

  const decrementField = (value: string, setter: (v: string) => void) => {
    const currentValue = parseFloat(value) || 0
    if (currentValue > 0) {
      setter(Math.max(0, currentValue - 0.001).toFixed(3))
    }
  }

  // Render buy/sell price buttons with spread overlay - solid backgrounds for one-click
  const renderPriceButtonsSolid = () => (
    <div className="relative grid grid-cols-2 gap-3">
      {/* Sell Button - Solid */}
      <button
        onClick={() => onSell?.({
          orderType,
          volume: parseFloat(volume),
          openPrice: openPrice ? parseFloat(openPrice) : undefined
        })}
        className="rounded-md p-3 bg-[#FF5555] hover:bg-[#FF5555]/90 transition-colors cursor-pointer text-left"
      >
        <div className="text-xs text-white/80 mb-1">Sell</div>
        <div className="price-font text-white font-bold text-sm leading-tight">
          {Math.floor(currentSellPrice).toLocaleString()}
          <span className="text-lg">.{String(Math.floor((currentSellPrice % 1) * 100)).padStart(2, '0')}</span>
          <sup className="text-sm">{String(Math.floor((currentSellPrice % 1) * 1000) % 10)}</sup>
        </div>
      </button>

      {/* Buy Button - Solid */}
      <button
        onClick={() => onBuy?.({
          orderType,
          volume: parseFloat(volume),
          openPrice: openPrice ? parseFloat(openPrice) : undefined
        })}
        className="rounded-md p-3 bg-[#4A9EFF] hover:bg-[#4A9EFF]/90 transition-colors cursor-pointer text-right"
      >
        <div className="text-xs text-white/80 mb-1">Buy</div>
        <div className="price-font text-white font-bold text-sm leading-tight">
          {Math.floor(currentBuyPrice).toLocaleString()}
          <span className="text-lg">.{String(Math.floor((currentBuyPrice % 1) * 100)).padStart(2, '0')}</span>
          <sup className="text-sm">{String(Math.floor((currentBuyPrice % 1) * 1000) % 10)}</sup>
        </div>
      </button>

      {/* Spread Overlay with Glassmorphism */}
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 px-2 py-0.5 rounded backdrop-blur-xl bg-white/[0.03] border border-white/10 text-[10px] text-white/80 font-medium whitespace-nowrap z-10">
        {currentSpread} {isSubscribed && <span className="text-green-500 ml-1">●</span>}
      </div>
    </div>
  )

  // Render buy/sell price buttons with spread overlay - bordered for regular/risk calculator
  const renderPriceButtonsBordered = () => (
    <div className="relative grid grid-cols-2 gap-3">
      {/* Sell Button - Bordered */}
      <button
        onClick={() => onSell?.({
          orderType,
          volume: parseFloat(volume),
          openPrice: openPrice ? parseFloat(openPrice) : undefined
        })}
        className="rounded-md p-3 border-2 border-[#FF5555] bg-transparent hover:bg-[#FF5555]/10 transition-colors cursor-pointer text-left"
      >
        <div className="text-xs text-white/60 mb-1">Sell</div>
        <div className="price-font text-[#FF5555] font-bold text-sm leading-tight">
          {Math.floor(currentSellPrice).toLocaleString()}
          <span className="text-lg">.{String(Math.floor((currentSellPrice % 1) * 100)).padStart(2, '0')}</span>
          <sup className="text-sm">{String(Math.floor((currentSellPrice % 1) * 1000) % 10)}</sup>
        </div>
      </button>

      {/* Buy Button - Bordered */}
      <button
        onClick={() => onBuy?.({
          orderType,
          volume: parseFloat(volume),
          openPrice: openPrice ? parseFloat(openPrice) : undefined
        })}
        className="rounded-md p-3 border-2 border-[#4A9EFF] bg-transparent hover:bg-[#4A9EFF]/10 transition-colors cursor-pointer text-right"
      >
        <div className="text-xs text-white/60 mb-1">Buy</div>
        <div className="price-font text-[#4A9EFF] font-bold text-sm leading-tight">
          {Math.floor(currentBuyPrice).toLocaleString()}
          <span className="text-lg">.{String(Math.floor((currentBuyPrice % 1) * 100)).padStart(2, '0')}</span>
          <sup className="text-sm">{String(Math.floor((currentBuyPrice % 1) * 1000) % 10)}</sup>
        </div>
      </button>

      {/* Spread Overlay with Glassmorphism */}
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 px-2 py-0.5 rounded backdrop-blur-xl bg-white/[0.03] border border-white/10 text-[10px] text-white/80 font-medium whitespace-nowrap z-10">
        {currentSpread} {isSubscribed && <span className="text-green-500 ml-1">●</span>}
      </div>
    </div>
  )

  // Render percentage slider
  const renderPercentageSlider = () => (
    <div className="relative">
      <div className="h-1 bg-white/5 rounded-full overflow-hidden flex">
        <motion.div
          className="h-full bg-[#FF5555]"
          initial={{ width: `${volumePercentage}%` }}
          animate={{ width: `${volumePercentage}%` }}
          transition={{ duration: 0.2 }}
        />
        <motion.div
          className="h-full bg-[#4A9EFF]"
          initial={{ width: `${100 - volumePercentage}%` }}
          animate={{ width: `${100 - volumePercentage}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-[#FF5555] font-medium">{volumePercentage}%</span>
        <span className="text-xs text-[#4A9EFF] font-medium">{100 - volumePercentage}%</span>
      </div>
    </div>
  )

  // Render input field with dropdown and +/- buttons
  const renderInputField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    mode: string,
    onModeChange: (v: string) => void,
    modeOptions: { value: string; label: string }[],
    showTooltip?: boolean
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-white/80">{label}</div>
        {showTooltip && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button className="cursor-pointer">
                <HelpCircle className="h-3.5 w-3.5 text-white/40" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Set {label.toLowerCase()}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Not set"
          className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/40"
        />
        <Select value={mode} onValueChange={onModeChange}>
          <SelectTrigger className="w-[70px] border-0 h-9 bg-transparent text-xs focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modeOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => decrementField(value, onChange)}
          className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
        >
          <Minus className="h-3.5 w-3.5 text-white/60" />
        </button>
        <button
          onClick={() => incrementField(value, onChange)}
          className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 text-white/60" />
        </button>
      </div>
    </div>
  )

  // Render additional info section
  const renderAdditionalInfo = () => (
    <div className="space-y-1 text-xs text-white/60">
      <div className="flex items-center justify-between">
        <span>Fees:</span>
        <span className="flex items-center gap-1">
          ≈ 16.00 USD
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button className="cursor-pointer">
                <HelpCircle className="h-3 w-3 text-white/40" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Trading fees</p>
            </TooltipContent>
          </Tooltip>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Leverage:</span>
        <span className="flex items-center gap-1">
          1:200
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button className="cursor-pointer">
                <HelpCircle className="h-3 w-3 text-white/40" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Account leverage</p>
            </TooltipContent>
          </Tooltip>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>Margin:</span>
        <span>2,174.77 USD</span>
      </div>

      {showMoreInfo && (
        <>
          <div className="flex items-center justify-between">
            <span>Pip Value:</span>
            <span>1.00 USD</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Volume in units:</span>
            <span>100.00 USD</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Volume in USD:</span>
            <span>434,475.00 USD</span>
          </div>
        </>
      )}

      <button
        onClick={() => setShowMoreInfo(!showMoreInfo)}
        className="text-left text-white/60 hover:text-white/80 transition-colors cursor-pointer"
      >
        {showMoreInfo ? "Less" : "More"}
      </button>
    </div>
  )

  return (
    <TooltipProvider>
      <div className={cn("w-[280px] glass-card border border-white/10 rounded-md overflow-hidden", className)} {...props}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <FlagIcon countryCode={countryCode} size="sm" />
            <span className="text-sm font-semibold text-white">{symbol}</span>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4 text-white/60" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Form Type Selector */}
          <Select value={formType} onValueChange={(value: string) => setFormType(value as FormType)}>
            <SelectTrigger className="w-full bg-white/[0.02] border-white/10 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-click">One-click form</SelectItem>
              <SelectItem value="regular">Regular form</SelectItem>
              <SelectItem value="risk-calculator">Risk calculator form</SelectItem>
            </SelectContent>
          </Select>

          {/* ONE-CLICK FORM */}
          {formType === "one-click" && (
            <>
              {/* Market/Limit Tabs */}
              <Tabs value={orderType} onValueChange={(value: string) => setOrderType(value as "market" | "limit" | "pending")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="market">Market</TabsTrigger>
                  <TabsTrigger value="limit">Limit</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Open Price - Only show for Limit orders */}
              {orderType === "limit" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-white/80">Open price</div>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <button className="cursor-pointer">
                          <HelpCircle className="h-3.5 w-3.5 text-white/40" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Set open price for limit order</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                    <Input
                      type="number"
                      value={openPrice}
                      onChange={(e) => setOpenPrice(e.target.value)}
                      placeholder={currentBuyPrice.toFixed(3)}
                      className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/40"
                    />
                    <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[50px]">
                      Limit
                    </div>
                    <button
                      onClick={() => decrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5 text-white/60" />
                    </button>
                    <button
                      onClick={() => incrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-white/60" />
                    </button>
                  </div>
                  {openPrice && (
                    <div className="text-xs text-white/60">
                      {((parseFloat(openPrice) - currentBuyPrice) * 10000).toFixed(1)} pips
                    </div>
                  )}
                </div>
              )}

        {/* Volume */}
        <div className="space-y-2">
                <div className="text-xs font-medium text-white/80">Volume</div>
                <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                  <Input
                    type="number"
            value={volume}
                    onChange={(e) => handleVolumeChange(e.target.value)}
                    className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[50px]">
                    Lots
                  </div>
                  <button
                    onClick={decrementVolume}
                    className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5 text-white/60" />
                  </button>
                  <button
                    onClick={incrementVolume}
                    className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-white/60" />
                  </button>
          </div>
        </div>

              {/* Sell/Buy Buttons with Spread - SOLID */}
              {renderPriceButtonsSolid()}

              {/* Percentage Slider */}
              {renderPercentageSlider()}

              {/* Additional Info */}
              {renderAdditionalInfo()}
            </>
          )}

          {/* REGULAR FORM */}
          {formType === "regular" && (
            <>
              {/* Sell/Buy Buttons with Spread - BORDERED */}
              {renderPriceButtonsBordered()}

              {/* Percentage Slider */}
              {renderPercentageSlider()}

              {/* Market/Pending Tabs */}
              <Tabs value={orderType} onValueChange={(value: string) => setOrderType(value as "market" | "limit" | "pending")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="market">Market</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Open Price - Only show for Pending orders */}
              {orderType === "pending" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-white/80">Open price</div>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <button className="cursor-pointer">
                          <HelpCircle className="h-3.5 w-3.5 text-white/40" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Set open price for pending order</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                    <Input
                      type="number"
                      value={openPrice}
                      onChange={(e) => setOpenPrice(e.target.value)}
                      placeholder={currentBuyPrice.toFixed(3)}
                      className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/40"
                    />
                    <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[50px]">
                      Limit
                    </div>
                    <button
                      onClick={() => decrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5 text-white/60" />
                    </button>
                    <button
                      onClick={() => incrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-white/60" />
                    </button>
                  </div>
                  {openPrice && (
                    <div className="text-xs text-white/60">
                      {((parseFloat(openPrice) - currentBuyPrice) * 10000).toFixed(1)} pips
                    </div>
                  )}
                </div>
              )}

              {/* Volume */}
        <div className="space-y-2">
                <div className="text-xs font-medium text-white/80">Volume</div>
                <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
          <Input
            type="number"
                    value={volume}
                    onChange={(e) => handleVolumeChange(e.target.value)}
                    className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[50px]">
                    Lots
                  </div>
                  <button
                    onClick={decrementVolume}
                    className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5 text-white/60" />
                  </button>
                  <button
                    onClick={incrementVolume}
                    className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-white/60" />
                  </button>
                </div>
        </div>

        {/* Take Profit */}
              {renderInputField(
                "Take Profit",
                takeProfit,
                setTakeProfit,
                takeProfitMode,
                (value: string) => setTakeProfitMode(value as "pips" | "price"),
                [
                  { value: "price", label: "Price" },
                  { value: "pips", label: "Pips" }
                ],
                true
              )}

              {/* Stop Loss */}
              {renderInputField(
                "Stop Loss",
                stopLoss,
                setStopLoss,
                stopLossMode,
                (value: string) => setStopLossMode(value as "pips" | "price"),
                [
                  { value: "price", label: "Price" },
                  { value: "pips", label: "Pips" }
                ],
                true
              )}

              {/* Additional Info */}
              {renderAdditionalInfo()}
            </>
          )}

          {/* RISK CALCULATOR FORM */}
          {formType === "risk-calculator" && (
            <>
              {/* Sell/Buy Buttons with Spread - BORDERED */}
              {renderPriceButtonsBordered()}

              {/* Percentage Slider */}
              {renderPercentageSlider()}

              {/* Market/Pending Tabs */}
              <Tabs value={orderType} onValueChange={(value: string) => setOrderType(value as "market" | "limit" | "pending")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="market">Market</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Open Price - Only show for Pending orders */}
              {orderType === "pending" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-white/80">Open price</div>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <button className="cursor-pointer">
                          <HelpCircle className="h-3.5 w-3.5 text-white/40" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Set open price for pending order</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-stretch border border-white/10 rounded-md overflow-hidden bg-white/[0.02] focus-within:border-[#8B5CF6]">
                    <Input
                      type="number"
                      value={openPrice}
                      onChange={(e) => setOpenPrice(e.target.value)}
                      placeholder={currentBuyPrice.toFixed(3)}
                      className="flex-1 border-0 bg-transparent text-center price-font text-sm h-9 focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/40"
                    />
                    <div className="flex items-center justify-center px-3 text-xs text-white/60 min-w-[50px]">
                      Stop
                    </div>
                    <button
                      onClick={() => decrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Minus className="h-3.5 w-3.5 text-white/60" />
                    </button>
                    <button
                      onClick={() => incrementField(openPrice, setOpenPrice)}
                      className="h-9 w-9 flex items-center justify-center hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-white/60" />
                    </button>
                  </div>
                  {openPrice && (
                    <div className="text-xs text-success">
                      +{((parseFloat(openPrice) - buyPrice) * 10000).toFixed(1)} pips
                    </div>
                  )}
                </div>
              )}

              {/* Risk */}
              {renderInputField(
                "Risk",
                risk,
                setRisk,
                riskMode,
                (value: string) => setRiskMode(value as "usd" | "percent"),
                [
                  { value: "usd", label: "USD" },
                  { value: "percent", label: "%" }
                ],
                true
              )}

              {/* Stop Loss */}
              {renderInputField(
                "Stop Loss",
                stopLoss,
                setStopLoss,
                stopLossMode,
                (value: string) => setStopLossMode(value as "pips" | "price"),
                [
                  { value: "pips", label: "Pips" },
                  { value: "price", label: "Price" }
                ],
                true
              )}

              {/* Take Profit */}
              {renderInputField(
                "Take Profit",
                takeProfit,
                setTakeProfit,
                takeProfitMode,
                (value: string) => setTakeProfitMode(value as "pips" | "price"),
                [
                  { value: "pips", label: "Pips" },
                  { value: "price", label: "Price" }
                ],
                true
              )}

              {/* Action Buttons - Only show for Pending orders */}
              {orderType === "pending" && (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => {
                      // Handle Set SL and Risk action
                      console.log("Set SL and Risk clicked")
                    }}
                    className="w-full py-2.5 px-4 rounded-md text-sm font-medium bg-white/10 text-white border border-white/20 hover:bg-white/[0.15] transition-colors cursor-pointer"
                  >
                    Set SL and Risk
                  </button>
                  <button
                    onClick={() => setOrderType("market")}
                    className="w-full py-2.5 px-4 rounded-md text-sm font-medium bg-white/[0.02] text-white border border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Additional Info */}
              {renderAdditionalInfo()}
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export { OrderPanel }

