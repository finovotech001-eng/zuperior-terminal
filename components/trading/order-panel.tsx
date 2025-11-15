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
import { useTickPolling } from "@/hooks/useTickPolling"

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
  balanceData?: {
    credit?: number
    leverage?: string
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
  balanceData,
  className,
  ...props
}) => {
  // Get real-time prices from WebSocket + polling fallback
  const hubSymbol = React.useMemo(() => symbol.replace('/', ''), [symbol])
  const { bid, ask, spread: liveSpread, isSubscribed } = useTickPrice(hubSymbol)
  const polled = useTickPolling([hubSymbol], 800)
  const pollTick = polled.get(hubSymbol)
  
  // Use live prices if available, otherwise fall back to props
  const currentSellPrice = (pollTick?.bid ?? bid) ?? sellPrice
  const currentBuyPrice = (pollTick?.ask ?? ask) ?? buyPrice
  const currentSpread = (pollTick?.spread ?? liveSpread) !== undefined ? `${((pollTick?.spread ?? liveSpread) as number).toFixed(2)} pips` : spread
  
  const [formType, setFormType] = React.useState<FormType>("regular")
  const [orderType, setOrderType] = React.useState<"market" | "limit" | "pending">("market")
  const [volume, setVolume] = React.useState("0.01")
  const [risk, setRisk] = React.useState("")
  const [riskMode, setRiskMode] = React.useState<"usd" | "percent">("usd")
  const [takeProfit, setTakeProfit] = React.useState("")
  const [takeProfitMode, setTakeProfitMode] = React.useState<"pips" | "price">("price")
  const [stopLoss, setStopLoss] = React.useState("")
  const [stopLossMode, setStopLossMode] = React.useState<"pips" | "price">("price")
  const [volumePercentage] = React.useState(21)
  const [openPrice, setOpenPrice] = React.useState("")
  const [showMoreDetails, setShowMoreDetails] = React.useState(false)

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
    // Allow empty string for typing
    if (value === '') {
      setVolume('')
      return
    }
    
    // Parse the value
    const numValue = parseFloat(value)
    
    // If not a valid number, keep current value
    if (isNaN(numValue)) {
      return
    }
    
    // Enforce minimum: 0.01
    if (numValue < 0.01) {
      setVolume('0.01')
      return
    }
    
    // Enforce maximum: 10.00
    if (numValue > 10.00) {
      setVolume('10.00')
      return
    }
    
    // Set the value (allow up to 2 decimal places)
    setVolume(value)
  }

  const incrementVolume = () => {
    const currentValue = parseFloat(volume) || 0.01
    const newValue = Math.min(10.00, currentValue + 0.01)
    setVolume(newValue.toFixed(2))
  }

  const decrementVolume = () => {
    const currentValue = parseFloat(volume) || 0.01
    const newValue = Math.max(0.01, currentValue - 0.01)
    setVolume(newValue.toFixed(2))
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
          openPrice: openPrice ? parseFloat(openPrice) : currentSellPrice,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
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
          openPrice: openPrice ? parseFloat(openPrice) : currentBuyPrice,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
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
          openPrice: openPrice ? parseFloat(openPrice) : currentSellPrice,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
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
          openPrice: openPrice ? parseFloat(openPrice) : currentBuyPrice,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
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

  // Calculate financial metrics in real-time
  const calculateFinancialMetrics = React.useMemo(() => {
    const vol = parseFloat(volume) || 0
    const price = orderType === "limit" && openPrice ? parseFloat(openPrice) : currentBuyPrice
    const symbolUpper = symbol.toUpperCase()
    
    // Determine contract size and pip value based on symbol type
    let contractSize = 100000 // Default for forex
    let pipValue = 0.0001 // Default pip size
    
    if (symbolUpper.includes('XAU') || symbolUpper.includes('XAG')) {
      // Metals: 1 lot = 100 oz, pip = 0.01
      contractSize = 100
      pipValue = 0.01
    } else if (symbolUpper.includes('BTC') || symbolUpper.includes('ETH')) {
      // Crypto: 1 lot = 1 unit, pip = 0.01
      contractSize = 1
      pipValue = 0.01
    } else {
      // Forex: 1 lot = 100,000 units, pip = 0.0001 (or 0.01 for JPY pairs)
      contractSize = 100000
      pipValue = symbolUpper.includes('JPY') ? 0.01 : 0.0001
    }
    
    // Extract leverage from balanceData (format: "1:400" or "400" or number)
    const leverageStr = String(balanceData?.leverage || "1:400")
    const leverageMatch = leverageStr.match(/:?(\d+)/)
    const leverage = leverageMatch ? parseInt(leverageMatch[1], 10) : 400
    
    // Calculate margin: (Volume * ContractSize * Price) / Leverage
    const margin = (vol * contractSize * price) / leverage
    
    // Calculate fees: Typically 0.1% of trade value (commission + spread)
    const tradeValue = vol * contractSize * price
    const fees = tradeValue * 0.001 // 0.1% commission
    
    // Calculate pip value: ContractSize * PipValue * Volume (for most pairs)
    const calculatedPipValue = contractSize * pipValue * vol
    
    // Swap calculations (simplified - typically negative for long positions)
    // Swap Long: Usually negative, calculated as percentage of position value
    const swapLong = -(tradeValue * 0.0001) // Simplified: -0.01% per day
    const swapShort = 0 // Usually 0 or minimal for short positions
    
    // Volume in units
    const volumeInUnits = vol * contractSize
    
    // Volume in USD
    const volumeInUSD = tradeValue
    
    // Credit from balance data
    const credit = balanceData?.credit || 0
    
    return {
      fees,
      leverage: `1:${leverage}`,
      margin,
      swapLong,
      swapShort,
      pipValue: calculatedPipValue,
      volumeInUnits,
      volumeInUSD,
      credit
    }
  }, [volume, currentBuyPrice, openPrice, orderType, symbol, balanceData])
  
  // Render financial details section
  const renderFinancialDetails = () => (
    <div className="space-y-2 pt-2 border-t border-white/10">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">Fees:</span>
        <div className="flex items-center gap-1">
          <span className="text-white price-font">≈ {calculateFinancialMetrics.fees.toFixed(2)} USD</span>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button className="cursor-pointer">
                <HelpCircle className="h-3 w-3 text-white/40" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Estimated commission and spread costs</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">Leverage:</span>
        <div className="flex items-center gap-1">
          <span className="text-white price-font">{calculateFinancialMetrics.leverage}</span>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button className="cursor-pointer">
                <HelpCircle className="h-3 w-3 text-white/40" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Account leverage ratio</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">Margin:</span>
        <span className="text-white price-font">{calculateFinancialMetrics.margin.toFixed(2)} USD</span>
      </div>
      
      {showMoreDetails && (
        <>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Swap Long:</span>
            <div className="flex items-center gap-1">
              <span className="text-white price-font">{calculateFinancialMetrics.swapLong.toFixed(2)} USD</span>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button className="cursor-pointer">
                    <HelpCircle className="h-3 w-3 text-white/40" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Overnight swap for long positions</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Swap Short:</span>
            <div className="flex items-center gap-1">
              <span className="text-white price-font">{calculateFinancialMetrics.swapShort.toFixed(2)} USD</span>
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button className="cursor-pointer">
                    <HelpCircle className="h-3 w-3 text-white/40" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Overnight swap for short positions</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Pip Value:</span>
            <span className="text-white price-font">{calculateFinancialMetrics.pipValue.toFixed(2)} USD</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Volume in units:</span>
            <span className="text-white price-font">{calculateFinancialMetrics.volumeInUnits.toFixed(2)} {symbol.toUpperCase().includes('BTC') ? 'BTC' : symbol.toUpperCase().includes('ETH') ? 'ETH' : symbol.toUpperCase().includes('XAU') ? 'oz' : ''}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Volume in USD:</span>
            <span className="text-white price-font">{calculateFinancialMetrics.volumeInUSD.toFixed(2)} USD</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/60">Credit:</span>
            <span className="text-white price-font">{calculateFinancialMetrics.credit.toFixed(2)} USD</span>
          </div>
        </>
      )}
      
      <button
        onClick={() => setShowMoreDetails(!showMoreDetails)}
        className="w-full flex items-center justify-center gap-1 text-xs text-white/60 hover:text-white/80 transition-colors pt-1"
      >
        {showMoreDetails ? (
          <>
            <span>Less</span>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </>
        ) : (
          <>
            <span>More</span>
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>
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
                    onBlur={(e) => {
                      // On blur, ensure value is within bounds
                      const numValue = parseFloat(e.target.value) || 0.01
                      const clampedValue = Math.max(0.01, Math.min(10.00, numValue))
                      setVolume(clampedValue.toFixed(2))
                    }}
                    min="0.01"
                    max="10.00"
                    step="0.01"
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
              
              {/* Financial Details */}
              {renderFinancialDetails()}
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
            onBlur={(e) => {
              // On blur, ensure value is within bounds
              const numValue = parseFloat(e.target.value) || 0.01
              const clampedValue = Math.max(0.01, Math.min(10.00, numValue))
              setVolume(clampedValue.toFixed(2))
            }}
            min="0.01"
            max="10.00"
            step="0.01"
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
              
              {/* Financial Details */}
              {renderFinancialDetails()}
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
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export { OrderPanel }
