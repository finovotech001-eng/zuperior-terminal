"use client"

import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { FlagIcon } from "@/components/data-display/flag-icon"

export interface EconomicEvent {
  id: string
  time: string
  title: string
  country: string
  countryCode: string
  impact: "high" | "medium" | "low"
  actual?: string
  forecast?: string
  previous?: string
  description?: string
}

export interface EconomicCalendarEventProps extends React.HTMLAttributes<HTMLDivElement> {
  event: EconomicEvent
}

const ImpactIndicator: React.FC<{ impact: "high" | "medium" | "low" }> = ({ impact }) => {
  const bars = impact === "high" ? 3 : impact === "medium" ? 2 : 1
  const color = impact === "high" ? "bg-[#EF4444]" : impact === "medium" ? "bg-[#F59E0B]" : "bg-[#FCD34D]"
  
  return (
    <div className="flex items-end gap-0.5 h-3">
      {[1, 2, 3].map((bar) => (
        <div
          key={bar}
          className={cn(
            "w-1 rounded-[1px]",
            bar <= bars ? color : "bg-white/10",
            bar === 1 && "h-1.5",
            bar === 2 && "h-2",
            bar === 3 && "h-3"
          )}
        />
      ))}
    </div>
  )
}

const EconomicCalendarEvent: React.FC<EconomicCalendarEventProps> = ({
  event,
  className,
  ...props
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <div
      className={cn(
        "border-b border-white/10 last:border-b-0",
        className
      )}
      {...props}
    >
      <div 
        className="flex items-start gap-2.5 px-3 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Time */}
        <div className="flex flex-col items-start min-w-[42px] pt-0.5">
          <div className="text-xs text-white/60 leading-none">{event.time.split(' ')[0]}</div>
          <div className="text-[10px] text-white/40 leading-none mt-0.5">{event.time.split(' ')[1]}</div>
        </div>

        {/* Event Title */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium mb-1 truncate">{event.title}</div>
          
          {/* Values Row */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 shrink-0">
              <FlagIcon countryCode={event.countryCode} size="xs" />
              <ImpactIndicator impact={event.impact} />
            </div>
            <div className="price-font text-white min-w-[42px] shrink-0">{event.actual || "-"}</div>
            <div className="price-font text-white/60 min-w-[42px] shrink-0">{event.forecast || "-"}</div>
            <div className="price-font text-white/40 min-w-[42px] shrink-0">{event.previous || "-"}</div>
          </div>
        </div>

        {/* Expand Icon */}
        {isExpanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-white/40 mt-1 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-white/40 mt-1 shrink-0" />
        )}
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && event.description && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pl-[56px]">
              <p className="text-xs text-white/60 leading-relaxed">
                {event.description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { EconomicCalendarEvent }

