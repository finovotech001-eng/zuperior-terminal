"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { FlagIcon } from "@/components/data-display/flag-icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SearchInput } from "@/components/forms/search-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAtom } from "jotai"
import { instrumentsAtom, toggleFavoriteAtom } from "@/lib/store"
import { Star } from "lucide-react"

export interface InstrumentTab {
  id: string
  symbol: string
  name?: string
  countryCode?: string
  icon?: React.ReactNode
}

export interface InstrumentTabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: InstrumentTab[]
  activeTabId: string
  onTabChange?: (tabId: string) => void
  onTabClose?: (tabId: string) => void
  onAddTab?: (instrumentId: string) => void
}

const categories = [
  { value: "favorites", label: "Favorites" },
  { value: "all", label: "All instruments" },
  { value: "forex", label: "Forex" },
  { value: "stocks", label: "Stocks" },
  { value: "crypto", label: "Crypto" },
  { value: "commodities", label: "Commodities" },
  { value: "indices", label: "Indices" },
]

// Simplified Instrument List for Popover
interface SimplifiedInstrumentListProps {
  onSelectInstrument: (id: string) => void
  searchQuery: string
  category: string
}

const SimplifiedInstrumentList: React.FC<SimplifiedInstrumentListProps> = ({
  onSelectInstrument,
  searchQuery,
  category,
}) => {
  const [items] = useAtom(instrumentsAtom)
  const [, toggleFavorite] = useAtom(toggleFavoriteAtom)

  // Get instrument description based on symbol
  const getDescription = React.useCallback((symbol: string) => {
    const descriptions: Record<string, string> = {
      "EUR/USD": "Euro vs US Dollar",
      "GBP/USD": "Great Britain Pound vs US Dollar",
      "USD/JPY": "US Dollar vs Japanese Yen",
      "XAU/USD": "Gold",
      "BTC/USD": "Bitcoin",
      "AAPL": "Apple Inc.",
      "USTEC": "US Tech 100 Index",
      "USOIL": "Crude Oil",
    }
    return descriptions[symbol] || symbol
  }, [])

  const handleToggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    toggleFavorite(id)
  }

  // Filter items based on search query and category
  const filteredItems = React.useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase().trim()
    const isSearching = normalizedQuery !== ""

    return items.filter(item => {
      const matchesSearch =
        !isSearching ||
        item.symbol.toLowerCase().includes(normalizedQuery) ||
        item.description?.toLowerCase().includes(normalizedQuery) ||
        getDescription(item.symbol).toLowerCase().includes(normalizedQuery)

      // If searching and found a match, return immediately regardless of category filter
      if (isSearching && matchesSearch) {
        return true
      }

      // If not searching, apply category filter
      if (!isSearching) {
        const matchesCategory =
          category === "all" ||
          (category === "favorites" && item.isFavorite) ||
          (category !== "favorites" && item.category === category)

        return matchesCategory
      }

      return false
    })
  }, [items, category, searchQuery, getDescription])

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center border-b border-white/10 bg-white/[0.02] sticky top-0 z-10">
        <div className="flex-1 px-4 py-2.5 text-xs font-medium text-white/60">
          Symbol
        </div>
        <div className="flex-1 px-4 py-2.5 text-xs font-medium text-white/60">
          Description
        </div>
        <div className="w-10 shrink-0"></div>
      </div>

      {/* Items */}
      {filteredItems.length > 0 ? (
        filteredItems.map((instrument) => (
          <div
            key={instrument.id}
            onClick={() => onSelectInstrument(instrument.id)}
            className="flex items-center border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
          >
            <div className="flex-1 px-4 py-2.5">
              <span className="text-sm font-medium text-white">
                {instrument.symbol}
              </span>
            </div>
            <div className="flex-1 px-4 py-2.5">
              <span className="text-sm text-white/60">
                {getDescription(instrument.symbol)}
              </span>
            </div>
            <div className="w-10 shrink-0 flex items-center justify-center">
              <button
                onClick={(e) => handleToggleFavorite(e, instrument.id)}
                className="hover:scale-110 transition-transform p-1"
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    instrument.isFavorite
                      ? "fill-warning text-warning"
                      : "text-white/40 hover:text-white/60"
                  )}
                />
              </button>
            </div>
          </div>
        ))
      ) : (
        <div className="flex items-center justify-center py-8 text-sm text-white/40">
          No instruments found
        </div>
      )}
    </div>
  )
}

const InstrumentTabs: React.FC<InstrumentTabsProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onAddTab,
  className,
  ...props
}) => {
  const [activeTabRect, setActiveTabRect] = React.useState<DOMRect | null>(null)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState("favorites")
  const tabsRef = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Update active tab indicator position
  React.useEffect(() => {
    const activeTab = tabsRef.current.get(activeTabId)
    if (activeTab && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const tabRect = activeTab.getBoundingClientRect()
      setActiveTabRect({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      } as DOMRect)
    }
  }, [activeTabId, tabs])

  const handleSelectInstrument = (instrumentId: string) => {
    onAddTab?.(instrumentId)
    setIsPopoverOpen(false)
    setSearchQuery("")
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center gap-1 !border-none overflow-x-auto scrollbar-thin px-2",
        className
      )}
      {...props}
    >
      {/* Tabs */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          ref={(el) => {
            if (el) tabsRef.current.set(tab.id, el)
            else tabsRef.current.delete(tab.id)
          }}
          onClick={() => onTabChange?.(tab.id)}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2.5 rounded-t-md transition-all cursor-pointer",
            "hover:bg-white/2",
            activeTabId === tab.id
              ? "text-white"
              : "text-white/60 hover:text-white/80"
          )}
        >
          {tab.countryCode && <FlagIcon countryCode={tab.countryCode} size="sm" />}
          {/* {tab.icon} */}
          <span className="text-sm font-medium whitespace-nowrap">{tab.symbol}</span>
          
          {onTabClose && tabs.length > 1 && (
            <motion.button
              onClick={(e) => {
                e.stopPropagation()
                onTabClose(tab.id)
              }}
              className="ml-1 p-0.5 rounded-sm hover:bg-white/10 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="h-3 w-3" />
            </motion.button>
          )}
        </div>
      ))}

      {/* Sliding Active Indicator */}
      <AnimatePresence>
        {activeTabRect && (
          <motion.div
            className="absolute bottom-0 h-0.5 bg-primary rounded-full"
            initial={false}
            animate={{
              left: activeTabRect.left,
              width: activeTabRect.width,
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
            }}
          />
        )}
      </AnimatePresence>

      {/* Add Tab Button with Popover */}
      {onAddTab && (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <motion.button
              className="ml-2 p-2 rounded-md hover:bg-white/5 transition-colors text-white/60 hover:text-white"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="h-4 w-4" />
            </motion.button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-[420px] p-0 glass-card backdrop-blur-2xl border-white/10 z-[100]" 
            align="start"
            sideOffset={8}
          >
            <div className="flex flex-col h-[70vh] max-h-[700px]">
              {/* Search */}
              <div className="p-3 border-b border-white/10 shrink-0">
                <SearchInput
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full"
                />
              </div>

              {/* Category Filter */}
              <div className="p-3 border-b border-white/10 shrink-0">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full bg-white/[0.02] border-white/10 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[110]">
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Instrument List - Simplified */}
              <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
                <SimplifiedInstrumentList 
                  onSelectInstrument={handleSelectInstrument} 
                  searchQuery={searchQuery}
                  category={selectedCategory}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

export { InstrumentTabs }

