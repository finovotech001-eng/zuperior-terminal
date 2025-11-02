"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { FlagIcon } from "@/components/data-display/flag-icon"
import { getCountryCode } from "@/lib/country-mapping"
import { EconomicIndicator } from "@/hooks/useEconomicIndicators"

export interface EconomicIndicatorsProps extends React.HTMLAttributes<HTMLDivElement> {
  indicators: EconomicIndicator[]
  showHeaders?: boolean
  maxHeight?: string
  groupByCategory?: boolean
}

const EconomicIndicators: React.FC<EconomicIndicatorsProps> = ({
  indicators,
  showHeaders = true,
  maxHeight = "600px",
  groupByCategory = true,
  className,
  ...props
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = React.useState(false)
  const [showBottomFade, setShowBottomFade] = React.useState(true)

  // Group indicators by category if enabled
  const groupedIndicators = React.useMemo(() => {
    if (!groupByCategory) {
      return { 'All': indicators }
    }

    const grouped: Record<string, EconomicIndicator[]> = {}
    indicators.forEach(indicator => {
      const category = indicator.category || 'Other'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(indicator)
    })

    // Sort categories and sort indicators within each category
    const sortedCategories = Object.keys(grouped).sort()
    const result: Record<string, EconomicIndicator[]> = {}
    sortedCategories.forEach(cat => {
      result[cat] = grouped[cat].sort((a, b) => {
        // Sort by importance first, then by name
        if (a.isImportant !== b.isImportant) {
          return a.isImportant ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    })

    return result
  }, [indicators, groupByCategory])

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
  }, [indicators])

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
              <div className="flex-1">Indicator</div>
              <div className="min-w-[80px] shrink-0 text-right">Value</div>
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

      {/* Indicators - Scrollable */}
      <div 
        ref={scrollContainerRef}
        className="flex flex-col overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20"
        onScroll={handleScroll}
        style={{
          scrollBehavior: "smooth"
        }}
      >
        {Object.keys(groupedIndicators).length > 0 ? (
          Object.entries(groupedIndicators).map(([category, categoryIndicators]) => (
            <div key={category}>
              {/* Category Header */}
              {groupByCategory && categoryIndicators.length > 0 && (
                <div className="px-3 py-2.5 border-b border-white/10 bg-[#01040D]/95 backdrop-blur-xl sticky top-0 z-10">
                  <h3 className="text-sm font-semibold text-white">{category}</h3>
                  <p className="text-xs text-white/40">{categoryIndicators.length} indicator{categoryIndicators.length !== 1 ? 's' : ''}</p>
                </div>
              )}
              
              {/* Indicators for this category */}
              <div className="flex flex-col">
                {categoryIndicators.map((indicator) => (
                  <div
                    key={indicator.id}
                    className="border-b border-white/10 last:border-b-0"
                  >
                    <div className="flex items-center gap-2.5 px-3 py-3 hover:bg-white/[0.02] transition-colors">
                      {/* Country Flag */}
                      <div className="min-w-[24px]">
                        <FlagIcon countryCode={getCountryCode(indicator.country)} size="xs" />
                      </div>

                      {/* Indicator Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-sm text-white font-medium truncate">
                            {indicator.name}
                          </div>
                          {indicator.isImportant && (
                            <div className="h-1.5 w-1.5 bg-[#EF4444] rounded-full shrink-0"></div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <span>{indicator.country}</span>
                          {indicator.subcategory && (
                            <>
                              <span>•</span>
                              <span>{indicator.subcategory}</span>
                            </>
                          )}
                          {indicator.frequency && (
                            <>
                              <span>•</span>
                              <span>{indicator.frequency}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Value */}
                      <div className="min-w-[80px] shrink-0 text-right">
                        <div className="text-sm font-medium text-white">
                          {indicator.currentValue !== null && indicator.currentValue !== undefined
                            ? `${indicator.currentValue}${indicator.unit || ''}`
                            : '-'}
                        </div>
                        {indicator.lastUpdate && (
                          <div className="text-[10px] text-white/40 mt-0.5">
                            {new Date(indicator.lastUpdate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center py-12 px-4">
            <p className="text-sm text-white/40">No economic indicators available</p>
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

export { EconomicIndicators }

