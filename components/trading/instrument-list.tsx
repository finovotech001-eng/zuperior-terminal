// /components/trading/instrument-list.tsx

"use client"

import * as React from "react"
import { useAtom } from "jotai"
import { Reorder } from "framer-motion"
import { Search, Settings2 } from "lucide-react"
import {
  instrumentsAtom,
  toggleFavoriteAtom,
  reorderInstrumentsAtom,
  instrumentColumnsAtom,
  toggleInstrumentColumnAtom,
  updateInstrumentColumnWidthAtom
} from "@/lib/store"
import { InstrumentListItem } from "./instrument-list-item"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { IconButton } from "@/components/ui/icon-button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { useMultipleTickPrices } from "@/hooks/useWebSocket"
import { useTickPolling } from "@/hooks/useTickPolling"

export interface Instrument {
  id: string
  symbol: string
  description?: string
  category: "forex" | "stocks" | "crypto" | "commodities" | "indices"
  signal: "up" | "down"
  bid: number
  ask: number
  change1d: number
  changePercent1d: number
  pnl?: number
  isFavorite: boolean
}

export interface InstrumentListProps {
  onSelectInstrument?: (id: string) => void
  showFilters?: boolean
}

const InstrumentList: React.FC<InstrumentListProps> = ({
  onSelectInstrument,
  showFilters = false,
}) => {
  const [items] = useAtom(instrumentsAtom)
  const [, toggleFavorite] = useAtom(toggleFavoriteAtom)
  const [, reorderInstruments] = useAtom(reorderInstrumentsAtom)
  const [columns] = useAtom(instrumentColumnsAtom)
  const [, toggleColumn] = useAtom(toggleInstrumentColumnAtom)
  const [, updateColumnWidth] = useAtom(updateInstrumentColumnWidthAtom)

  // Default filter is "favorites" as requested
  const [categoryFilter, setCategoryFilter] = React.useState<string>("favorites")

  const [searchQuery, setSearchQuery] = React.useState("")
  const [resizingColumn, setResizingColumn] = React.useState<string | null>(null)

  // 1. 🚀 OPTIMIZATION: Use useDeferredValue for filtering state
  // This tells React that updates to these values are low priority and should be
  // deferred, allowing price updates (which use 'items') to render quickly.
  const deferredSearchQuery = React.useDeferredValue(searchQuery)
  const deferredCategoryFilter = React.useDeferredValue(categoryFilter)


  const handleReorder = (newOrder: Instrument[]) => {
    reorderInstruments(newOrder)
  }

  const handleToggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    toggleFavorite(id)
  }

  // Column resizing logic (kept the same)
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault()
    setResizingColumn(columnKey)

    const startX = e.pageX
    const column = columns.find(col => col.key === columnKey)
    const startWidth = column?.width || 100

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX
      const newWidth = Math.max(50, startWidth + deltaX)
      updateColumnWidth(columnKey, newWidth)
    }

    const handleMouseUp = () => {
      setResizingColumn(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Get visible columns (kept the same)
  const visibleColumns = React.useMemo(() => columns.filter(col => col.visible), [columns])

  // --- FILTER INSTRUMENTS (UPDATED TO USE DEFERRED VALUES) ---
  const filteredItems = React.useMemo(() => {
    // Use the deferred search query and category filter
    const normalizedQuery = deferredSearchQuery.toLowerCase().trim()
    const isSearching = normalizedQuery !== ""

    return items.filter(item => {

      const matchesSearch =
        !isSearching || // If not searching, this is always true
        item.symbol.toLowerCase().includes(normalizedQuery) ||
        item.description?.toLowerCase().includes(normalizedQuery)

      // If we are searching AND we found a match, RETURN IT IMMEDIATELY, regardless of category filter.
      if (isSearching && matchesSearch) {
        return true
      }

      // If we are NOT searching (or searching but found no match), apply the category filter.
      if (!isSearching) {
        const matchesCategory =
          deferredCategoryFilter === "all" ||
          (deferredCategoryFilter === "favorites" && item.isFavorite) ||
          (deferredCategoryFilter !== "favorites" && item.category === deferredCategoryFilter)

        return matchesCategory
      }

      // If searching and no match found, return false.
      return false
    })

  // 2. 🔑 CRITICAL DEPENDENCY CHANGE: Use deferred values in the dependency array
  // This ensures the expensive filter only re-runs when the deferred values stabilize.
  }, [items, deferredCategoryFilter, deferredSearchQuery])

  // Sort favorites to appear at the top when not searching
  const sortedFilteredItems = React.useMemo(() => {
    // Only sort if we are NOT searching and the filter is set to favorites.
    // Use the deferred values for a stable sort key
    if (deferredSearchQuery.trim() === "" && deferredCategoryFilter === "favorites") {
      // Reorder items based on the order stored in the atom (which is already done by the atom itself),
      // then filter again to ensure only favorites are shown.
      return filteredItems.slice().sort(() => {
        // Maintain the order received from the Jotai store after filtering.
        return 0;
      })
    }
    return filteredItems
  // 3. 🔑 CRITICAL DEPENDENCY CHANGE: Use deferred values in the dependency array
  }, [filteredItems, deferredSearchQuery, deferredCategoryFilter])

  // Subscribe to live ticks for currently visible symbols (limit to 100)
  const hubSymbols = React.useMemo(() => {
    const toHub = (s: string) => s.replace('/', '')
    return sortedFilteredItems.slice(0, 100).map(i => toHub(i.symbol))
  }, [sortedFilteredItems])

  const livePrices = useMultipleTickPrices(hubSymbols)
  // REST polling fallback for up to 20 symbols
  const polled = useTickPolling(hubSymbols, 800)


  return (
    <div className="flex flex-col w-full h-full">
      {/* Filters */}
      {showFilters && (
        <div className="flex flex-col gap-2 px-3 py-3 border-b border-white/10 bg-[#01040D]/95 backdrop-blur-xl shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              type="text"
              placeholder="Search all instruments" // Improved placeholder
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full h-9 pl-9 pr-3 rounded-md",
                "bg-white/5 border border-white/10",
                "text-sm text-white placeholder:text-white/40",
                "focus:outline-none focus:border-primary/50 focus:bg-white/[0.07]",
                "transition-colors"
              )}
            />
          </div>

          <div className="flex gap-2">
            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Favorites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="favorites">Favorites</SelectItem>
                <SelectItem value="all">All instruments</SelectItem>
                <SelectItem value="forex">Forex</SelectItem>
                <SelectItem value="stocks">Stocks</SelectItem>
                <SelectItem value="crypto">Crypto</SelectItem>
                <SelectItem value="commodities">Commodities</SelectItem>
                <SelectItem value="indices">Indices</SelectItem>
              </SelectContent>
            </Select>

            {/* Column Settings */}
            <Popover>
              <PopoverTrigger asChild>
                <IconButton size="sm" variant="ghost" className="shrink-0">
                  <Settings2 className="h-4 w-4" />
                </IconButton>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="end">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-white">Columns</h4>
                  <div className="space-y-2">
                    {columns.map((column) => (
                      <div key={column.key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={column.key}
                          checked={column.visible}
                          onChange={() => toggleColumn(column.key)}
                          className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary focus:ring-2 focus:ring-primary/50"
                        />
                        <Label className="text-xs text-white/80 cursor-pointer flex-1" htmlFor={column.key}>
                          {column.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <div className="inline-block min-w-full">
          {/* Header */}
          <div className="flex items-stretch border-b border-white/10">
            {/* Drag Handle Column (always visible) */}
            <div className="w-[28px] shrink-0 sticky left-0 z-20 backdrop-blur-xl bg-white/[0.03] border-r border-white/10"></div>

            {/* Dynamic Headers */}
            {visibleColumns.map((column) => {
              const isSymbol = column.key === "symbol"
              return (
                <div
                  key={column.key}
                  className={cn(
                    "relative flex items-center px-3 py-2 text-xs font-medium text-white/60 group shrink-0",
                    isSymbol && "sticky left-[28px] z-20 backdrop-blur-xl bg-white/[0.03] border-r border-white/10",
                    column.key === "signal" && "justify-center",
                    (column.key === "bid" || column.key === "ask" || column.key === "change" || column.key === "pnl") && "justify-end"
                  )}
                  style={{ width: `${column.width}px` }}
                >
                  {column.label}
                  {/* Resize Handle */}
                  <div
                    className={cn(
                      "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors",
                      resizingColumn === column.key && "bg-primary"
                    )}
                    onMouseDown={(e) => handleResizeStart(e, column.key)}
                  />
                </div>
              )
            })}

            {/* Star Column (always visible) */}
            <div className="w-[40px] px-2 py-2 text-xs font-medium text-white/60 text-center shrink-0"></div>
          </div>

          {/* List Items */}
          {sortedFilteredItems.length > 0 ? (
            <Reorder.Group
              axis="y"
              // Use sortedFilteredItems which maintains the order from the atom when not searching
              values={sortedFilteredItems}
              onReorder={handleReorder}
              className="flex flex-col"
            >
              {sortedFilteredItems.map((instrument) => (
                <Reorder.Item
                  key={instrument.id}
                  value={instrument}
                  as="div"
                >
                  {(() => {
                    const hubSymbol = instrument.symbol.replace('/', '')
                    // Prefer polling value if present; else websocket; else static
                    const pollTick = polled.get(hubSymbol)
                    const wsTick = livePrices.get(hubSymbol)
                    const liveBid = (pollTick?.bid ?? wsTick?.bid) ?? instrument.bid
                    const liveAsk = (pollTick?.ask ?? wsTick?.ask) ?? instrument.ask
                    return (
                      <InstrumentListItem
                        symbol={instrument.symbol}
                        signal={instrument.signal}
                        bid={liveBid}
                        ask={liveAsk}
                        changePercent1d={instrument.changePercent1d}
                        pnl={instrument.pnl}
                        isFavorite={instrument.isFavorite}
                        onToggleFavorite={(e) => handleToggleFavorite(e, instrument.id)}
                        onClick={() => onSelectInstrument?.(instrument.id)}
                        columns={visibleColumns}
                      />
                    )
                  })()}
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className="flex items-center justify-center py-12 px-4">
              <p className="text-sm text-white/40">No instruments match your filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export { InstrumentList }
