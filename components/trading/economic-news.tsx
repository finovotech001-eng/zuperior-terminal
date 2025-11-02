"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { EconomicNews } from "@/hooks/useEconomicNews"
import { ExternalLink, Clock } from "lucide-react"

export interface EconomicNewsProps extends React.HTMLAttributes<HTMLDivElement> {
  news: EconomicNews[]
  showHeaders?: boolean
  maxHeight?: string
}

const EconomicNews: React.FC<EconomicNewsProps> = ({
  news,
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
  }, [news])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return '-'
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      if (diffMins < 60) {
        return `${diffMins}m ago`
      } else if (diffHours < 24) {
        return `${diffHours}h ago`
      } else if (diffDays < 7) {
        return `${diffDays}d ago`
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
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
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-medium text-white/40 uppercase tracking-wide">
              Economic News
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

      {/* News Items - Scrollable */}
      <div 
        ref={scrollContainerRef}
        className="flex flex-col overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20"
        onScroll={handleScroll}
        style={{
          scrollBehavior: "smooth"
        }}
      >
        {news.length > 0 ? (
          news.map((item) => (
            <div
              key={item.id}
              className="border-b border-white/10 last:border-b-0"
            >
              <div className="px-3 py-3 hover:bg-white/[0.02] transition-colors">
                {/* Breaking News Badge */}
                {item.isBreaking && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="h-2 w-2 bg-[#EF4444] rounded-full animate-pulse"></div>
                    <span className="text-xs font-semibold text-[#EF4444] uppercase tracking-wide">
                      Breaking
                    </span>
                  </div>
                )}

                {/* Title */}
                <div className="flex items-start gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-white leading-snug flex-1">
                    {item.title}
                  </h3>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-white/40 hover:text-white transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {/* Summary */}
                {item.summary && (
                  <p className="text-xs text-white/70 mb-2 line-clamp-2 leading-relaxed">
                    {item.summary}
                  </p>
                )}

                {/* Meta Information */}
                <div className="flex items-center gap-2 flex-wrap text-xs text-white/50">
                  {item.source && (
                    <>
                      <span className="font-medium">{item.source}</span>
                      <span>•</span>
                    </>
                  )}
                  {item.category && (
                    <>
                      <span>{item.category}</span>
                      <span>•</span>
                    </>
                  )}
                  {item.publishedAt && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(item.publishedAt)}</span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {item.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-white/5 text-white/60 text-[10px] rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-[10px] text-white/40">
                        +{item.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-center justify-center py-12 px-4">
            <p className="text-sm text-white/40">No economic news available</p>
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

export { EconomicNews }

