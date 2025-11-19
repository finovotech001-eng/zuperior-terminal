"use client"

import * as React from "react"
import { useAtom } from "jotai"
import { cn } from "@/lib/utils"
import { EconomicCalendarEvent, EconomicEvent } from "./economic-calendar-event"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { settingsAtom } from "@/lib/store"

export interface EventsByDate {
  date: string
  displayDate: string
  events: EconomicEvent[]
}

export interface EconomicCalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  eventsByDate: EventsByDate[]
  showHeaders?: boolean
  maxHeight?: string
  showFilters?: boolean
}

const EconomicCalendar: React.FC<EconomicCalendarProps> = ({
  eventsByDate,
  showHeaders = true,
  maxHeight = "600px",
  showFilters = false,
  className,
  ...props
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = React.useState(false)
  const [showBottomFade, setShowBottomFade] = React.useState(true)
  const [impactFilter, setImpactFilter] = React.useState<string>("all")
  const [countryFilter, setCountryFilter] = React.useState<string>("all")
  const [settings] = useAtom(settingsAtom)

  // Filter events based on selected filters and settings
  const filteredEventsByDate = React.useMemo(() => {
    return eventsByDate.map(dateGroup => ({
      ...dateGroup,
      events: dateGroup.events.filter(event => {
        // Map event impact to settings impact levels
        // Events use: high, medium, low
        // Settings use: high, middle, low, lowest
        let matchesImpact = false
        
        // Check if at least one impact level is enabled
        const hasAnyImpactEnabled = settings.economicCalendarHighImpact || 
            settings.economicCalendarMiddleImpact || 
            settings.economicCalendarLowImpact || 
            settings.economicCalendarLowestImpact
        
        if (hasAnyImpactEnabled) {
          // At least one impact level is enabled, check if this event matches
          if (event.impact === 'high' && settings.economicCalendarHighImpact) {
            matchesImpact = true
          } else if (event.impact === 'medium' && settings.economicCalendarMiddleImpact) {
            matchesImpact = true
          } else if (event.impact === 'low') {
            // Low impact events match if either low or lowest is enabled
            if (settings.economicCalendarLowImpact || settings.economicCalendarLowestImpact) {
              matchesImpact = true
            }
          }
        }
        // If no impact levels are enabled, matchesImpact remains false (show nothing)
        
        // Also respect the UI filter if showFilters is true
        const matchesUIFilter = impactFilter === "all" || event.impact === impactFilter
        const matchesCountry = countryFilter === "all" || event.countryCode === countryFilter
        
        return matchesImpact && matchesUIFilter && matchesCountry
      })
    })).filter(dateGroup => dateGroup.events.length > 0)
  }, [eventsByDate, impactFilter, countryFilter, settings])

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
  }, [filteredEventsByDate])

  return (
    <div 
      className={cn("relative flex flex-col overflow-hidden min-w-[320px]", className)} 
      style={{ maxHeight }}
      {...props}
    >
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-col gap-2 px-3 py-3 border-b border-white/10 bg-[#01040D]/95 backdrop-blur-xl shrink-0 z-20">
          <Select value={impactFilter} onValueChange={setImpactFilter}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="All impacts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All impacts</SelectItem>
              <SelectItem value="high">
                <div className="flex items-center gap-2">
                  <div className="flex items-end gap-0.5 h-3">
                    <div className="w-1 h-1.5 bg-[#EF4444] rounded-[1px]" />
                    <div className="w-1 h-2 bg-[#EF4444] rounded-[1px]" />
                    <div className="w-1 h-3 bg-[#EF4444] rounded-[1px]" />
                  </div>
                  <span>High impact</span>
                </div>
              </SelectItem>
              <SelectItem value="medium">
                <div className="flex items-center gap-2">
                  <div className="flex items-end gap-0.5 h-3">
                    <div className="w-1 h-1.5 bg-[#F59E0B] rounded-[1px]" />
                    <div className="w-1 h-2 bg-[#F59E0B] rounded-[1px]" />
                    <div className="w-1 h-3 bg-white/10 rounded-[1px]" />
                  </div>
                  <span>Middle impact</span>
                </div>
              </SelectItem>
              <SelectItem value="low">
                <div className="flex items-center gap-2">
                  <div className="flex items-end gap-0.5 h-3">
                    <div className="w-1 h-1.5 bg-[#FCD34D] rounded-[1px]" />
                    <div className="w-1 h-2 bg-white/10 rounded-[1px]" />
                    <div className="w-1 h-3 bg-white/10 rounded-[1px]" />
                  </div>
                  <span>Low impact</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All countries</SelectItem>
              <SelectItem value="AU">Australia</SelectItem>
              <SelectItem value="AT">Austria</SelectItem>
              <SelectItem value="BE">Belgium</SelectItem>
              <SelectItem value="BR">Brazil</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="CN">China</SelectItem>
              <SelectItem value="CY">Cyprus</SelectItem>
              <SelectItem value="CZ">Czechia</SelectItem>
              <SelectItem value="DK">Denmark</SelectItem>
              <SelectItem value="EU">European Union</SelectItem>
              <SelectItem value="FI">Finland</SelectItem>
              <SelectItem value="FR">France</SelectItem>
              <SelectItem value="DE">Germany</SelectItem>
              <SelectItem value="GB">Great Britain</SelectItem>
              <SelectItem value="JP">Japan</SelectItem>
              <SelectItem value="NZ">New Zealand</SelectItem>
              <SelectItem value="CH">Switzerland</SelectItem>
              <SelectItem value="US">United States</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Column Headers */}
      {showHeaders && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-white/10 bg-[#01040D]/95 backdrop-blur-xl shrink-0 z-20">
          <div className="min-w-[42px]"></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-medium text-white/40 uppercase tracking-wide">
              <div className="w-[52px] shrink-0"></div>
              <div className="min-w-[42px] shrink-0">Actual</div>
              <div className="min-w-[42px] shrink-0">Forecast</div>
              <div className="min-w-[42px] shrink-0">Previous</div>
            </div>
          </div>
          <div className="w-3.5"></div>
        </div>
      )}

      {/* Top Fade Indicator */}
      {showTopFade && (
        <div
          className="absolute top-0 left-0 right-0 h-12 pointer-events-none z-10"
          style={{
            background: "linear-gradient(to bottom, rgba(1, 4, 13, 0.9), transparent)",
            marginTop: showHeaders ? "41px" : "0",
            opacity: showTopFade ? 1 : 0
          }}
        />
      )}

      {/* Events grouped by date - Scrollable */}
      <div 
        ref={scrollContainerRef}
        className="flex flex-col overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20"
        onScroll={handleScroll}
      >
        {filteredEventsByDate.length > 0 ? (
          filteredEventsByDate.map((dateGroup) => (
            <div key={dateGroup.date}>
              {/* Date Header */}
              <div className="px-3 py-2.5 border-b border-white/10 bg-[#01040D]/95 backdrop-blur-xl sticky top-0 z-10">
                <h3 className="text-sm font-semibold text-white">{dateGroup.displayDate}</h3>
              </div>
              
              {/* Events for this date */}
              <div className="flex flex-col">
                {dateGroup.events.map((event) => (
                  <EconomicCalendarEvent key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center py-12 px-4">
            <p className="text-sm text-white/40">No events match your filters</p>
          </div>
        )}
      </div>

      {/* Bottom Fade Indicator */}
      {showBottomFade && (
        <div
          className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none z-10"
          style={{
            background: "linear-gradient(to top, rgba(1, 4, 13, 0.9), transparent)",
            opacity: showBottomFade ? 1 : 0
          }}
        />
      )}
    </div>
  )
}

export { EconomicCalendar }

