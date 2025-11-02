"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { FlagIcon } from "@/components/data-display/flag-icon"
import { getCountryCode } from "@/lib/country-mapping"
import { InterestRate } from "@/hooks/useInterestRates"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

export interface InterestRatesProps extends React.HTMLAttributes<HTMLDivElement> {
  interestRates: InterestRate[]
  showHeaders?: boolean
  maxHeight?: string
}

const InterestRates: React.FC<InterestRatesProps> = ({
  interestRates,
  showHeaders = true,
  maxHeight = "600px",
  className,
  ...props
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = React.useState(false)
  const [showBottomFade, setShowBottomFade] = React.useState(true)

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const scrollTop = target.scrollTop
    const scrollHeight = target.scrollHeight
    const clientHeight = target.clientHeight

    // Show top fade if scrolled down
    setShowTopFade(scrollTop > 20)
    
    // Show bottom fade if not at bottom
    setShowBottomFade(scrollTop + clientHeight < scrollHeight - 20)
  }, [])

  React.useEffect(() => {
    // Check if content overflows on mount
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current
      setShowBottomFade(scrollHeight > clientHeight)
    }
  }, [interestRates])

  const getRateDirectionIcon = (direction: string) => {
    const dir = direction?.toLowerCase() || 'neutral'
    if (dir.includes('up') || dir.includes('increase') || dir.includes('rise')) {
      return <ArrowUp className="h-3.5 w-3.5 text-green-400" />
    } else if (dir.includes('down') || dir.includes('decrease') || dir.includes('fall')) {
      return <ArrowDown className="h-3.5 w-3.5 text-red-400" />
    }
    return <Minus className="h-3.5 w-3.5 text-gray-400" />
  }

  const getRateDirectionColor = (direction: string) => {
    const dir = direction?.toLowerCase() || 'neutral'
    if (dir.includes('up') || dir.includes('increase') || dir.includes('rise')) {
      return 'text-green-400'
    } else if (dir.includes('down') || dir.includes('decrease') || dir.includes('fall')) {
      return 'text-red-400'
    }
    return 'text-gray-400'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return '-'
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return '-'
    }
  }

  return (
    <div 
      className={cn("relative flex flex-col overflow-hidden min-w-[320px]", className)} 
      style={{ maxHeight }}
      {...props}
    >
      {/* Column Headers */}
      {showHeaders && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/10 bg-[#01040D]/95 backdrop-blur-xl shrink-0 z-20">
          <div className="min-w-[24px]"></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-medium text-white/40 uppercase tracking-wide">
              <div className="flex-1">Bank / Rate</div>
              <div className="min-w-[100px] shrink-0 text-right">Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Fade Indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-12 pointer-events-none z-10"
        style={{
          background: "linear-gradient(to bottom, rgba(1, 4, 13, 0.9), transparent)",
          marginTop: showHeaders ? "41px" : "0"
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: showTopFade ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Interest Rates - Scrollable */}
      <div 
        ref={scrollContainerRef}
        className="flex flex-col overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20"
        onScroll={handleScroll}
        style={{
          scrollBehavior: "smooth"
        }}
      >
        {interestRates.length > 0 ? (
          interestRates.map((rate) => (
            <div
              key={rate.id}
              className="border-b border-white/10 last:border-b-0"
            >
              <div className="flex items-center gap-2.5 px-3 py-3 hover:bg-white/[0.02] transition-colors">
                {/* Country Flag */}
                <div className="min-w-[24px]">
                  <FlagIcon countryCode={getCountryCode(rate.country)} size="xs" />
                </div>

                {/* Rate Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-sm text-white font-medium truncate">
                      {rate.bankName}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-white/60">
                    <span>{rate.country}</span>
                    <span>•</span>
                    <span>{rate.rateType}</span>
                    {rate.currency && (
                      <>
                        <span>•</span>
                        <span>{rate.currency}</span>
                      </>
                    )}
                  </div>

                  {/* Additional Info */}
                  {(rate.nextMeetingDate || rate.lastChangeDate) && (
                    <div className="flex items-center gap-2 text-xs text-white/40 mt-1">
                      {rate.lastChangeDate && (
                        <>
                          <span>Last change: {formatDate(rate.lastChangeDate)}</span>
                        </>
                      )}
                      {rate.nextMeetingDate && (
                        <>
                          {rate.lastChangeDate && <span>•</span>}
                          <span>Next meeting: {formatDate(rate.nextMeetingDate)}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Rate Value */}
                <div className="min-w-[100px] shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1.5 mb-1">
                    {getRateDirectionIcon(rate.rateDirection)}
                    <div className={`text-sm font-medium ${getRateDirectionColor(rate.rateDirection)}`}>
                      {rate.currentRate !== null && rate.currentRate !== undefined
                        ? `${rate.currentRate}%`
                        : '-'}
                    </div>
                  </div>
                  {rate.previousRate !== null && rate.previousRate !== undefined && (
                    <div className="text-[10px] text-white/40">
                      Prev: {rate.previousRate}%
                    </div>
                  )}
                  <div className={`text-[10px] ${getRateDirectionColor(rate.rateDirection)} mt-0.5`}>
                    {rate.rateDirection || 'Neutral'}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center py-12 px-4">
            <p className="text-sm text-white/40">No interest rates available</p>
          </div>
        )}
      </div>

      {/* Bottom Fade Indicator */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none z-10"
        style={{
          background: "linear-gradient(to top, rgba(1, 4, 13, 0.9), transparent)"
        }}
        initial={{ opacity: 1 }}
        animate={{ opacity: showBottomFade ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
    </div>
  )
}

export { InterestRates }

