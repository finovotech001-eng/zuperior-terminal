import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { Instrument } from '@/components/trading/instrument-list'

// --- 1. Instrument List Atoms ---

// Instruments atom with localStorage persistence
export const instrumentsAtom = atomWithStorage<Instrument[]>('zuperior-instruments', [])

// Helper atoms
export const toggleFavoriteAtom = atom(
  null,
  (get, set, id: string) => {
    const instruments = get(instrumentsAtom)
    const updated = instruments.map(item =>
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    )
    set(instrumentsAtom, updated)
  }
)

export const reorderInstrumentsAtom = atom(
  null,
  (get, set, newOrder: Instrument[]) => {
    set(instrumentsAtom, newOrder)
  }
)

// Instruments List columns with localStorage persistence
export interface InstrumentColumnConfig {
  key: string
  label: string
  visible: boolean
  width: number
}

// Default column configuration
const defaultInstrumentColumns: InstrumentColumnConfig[] = [
  { key: "symbol", label: "Symbol", visible: true, width: 176 },
  { key: "signal", label: "Signal", visible: false, width: 30 },
  { key: "bid", label: "Bid", visible: true, width: 90 },
  { key: "ask", label: "Ask", visible: true, width: 90 },
  { key: "change", label: "1D", visible: true, width: 80 },
  { key: "pnl", label: "P/L", visible: false, width: 80 },
]

// Helper function to migrate existing columns and ensure signal/pnl are unchecked
const migrateInstrumentColumns = (stored: InstrumentColumnConfig[] | null): InstrumentColumnConfig[] => {
  if (!stored || stored.length === 0) {
    return defaultInstrumentColumns
  }

  // Create a map for quick lookup of default columns
  const defaultMap = new Map(defaultInstrumentColumns.map(col => [col.key, col]))
  
  // Migrate stored columns, ensuring signal and pnl are set to visible: false
  return stored.map(col => {
    const defaultCol = defaultMap.get(col.key)
    if (col.key === "signal" || col.key === "pnl") {
      // Force signal and pnl to be unchecked
      return { ...col, visible: false }
    }
    // For other columns, use stored value or default
    return defaultCol ? { ...defaultCol, ...col } : col
  }).concat(
    // Add any missing default columns
    defaultInstrumentColumns.filter(defaultCol => 
      !stored.some(storedCol => storedCol.key === defaultCol.key)
    )
  )
}

export const instrumentColumnsAtom = atomWithStorage<InstrumentColumnConfig[]>(
  'zuperior-instrument-columns',
  defaultInstrumentColumns,
  {
    getItem: (key, initialValue) => {
      try {
        const stored = localStorage.getItem(key)
        if (stored === null) return initialValue
        const parsed = JSON.parse(stored)
        return migrateInstrumentColumns(parsed)
      } catch {
        return initialValue
      }
    },
    setItem: (key, value) => {
      localStorage.setItem(key, JSON.stringify(value))
    },
    removeItem: (key) => {
      localStorage.removeItem(key)
    },
  }
)

// Helper atom to toggle instrument column visibility
export const toggleInstrumentColumnAtom = atom(
  null,
  (get, set, key: string) => {
    const columns = get(instrumentColumnsAtom)
    const updated = columns.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    )
    set(instrumentColumnsAtom, updated)
  }
)

// Helper atom to update instrument column width
export const updateInstrumentColumnWidthAtom = atom(
  null,
  (get, set, key: string, width: number) => {
    const columns = get(instrumentColumnsAtom)
    const updated = columns.map(col =>
      col.key === key ? { ...col, width } : col
    )
    set(instrumentColumnsAtom, updated)
  }
)

// --- 2. Positions Table Atoms ---

export interface ColumnConfig {
  key: string
  label: string
  visible: boolean
}

export const positionsActiveTabAtom = atomWithStorage<string>('zuperior-positions-tab', 'open')
export const positionsIsGroupedAtom = atomWithStorage<boolean>('zuperior-positions-grouped', false)
export const positionsIsCollapsedAtom = atom<boolean>(false) // Don't persist collapse state
export const positionsColumnsAtom = atomWithStorage<ColumnConfig[]>('zuperior-positions-columns', [
  { key: "symbol", label: "Symbol", visible: true },
  { key: "type", label: "Type", visible: true },
  { key: "volume", label: "Volume, lot", visible: true },
  { key: "openPrice", label: "Open price", visible: true },
  { key: "currentPrice", label: "Current price", visible: true },
  { key: "tp", label: "T/P", visible: true },
  { key: "sl", label: "S/L", visible: true },
  { key: "position", label: "Position", visible: true },
  { key: "openTime", label: "Open time", visible: true },
  { key: "swap", label: "Swap, USD", visible: true },
  { key: "pnl", label: "P/L, USD", visible: true },
])

// Helper atom to toggle column visibility
export const togglePositionColumnAtom = atom(
  null,
  (get, set, key: string) => {
    const columns = get(positionsColumnsAtom)
    const updated = columns.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    )
    set(positionsColumnsAtom, updated)
  }
)

// --- 3. Instrument Tabs Atoms ---

export interface OpenTab {
  id: string
  symbol: string
  name?: string
  countryCode?: string
}

export const openTabsAtom = atomWithStorage<OpenTab[]>('zuperior-open-tabs', [
  { id: '1', symbol: 'XAU/USD', name: 'Gold vs US Dollar', countryCode: 'US' }
])

export const activeTabIdAtom = atomWithStorage<string>('zuperior-active-tab', '1')

// Helper function to get country code from symbol
function getCountryCodeFromSymbol(symbol: string): string | undefined {
  // Extract country code from forex pairs (e.g., EUR/USD -> EU, GBP/USD -> GB)
  if (symbol.includes('/')) {
    const [first] = symbol.split('/')
    // Map currency codes to country codes
    const currencyToCountry: Record<string, string> = {
      'EUR': 'EU',
      'GBP': 'GB',
      'USD': 'US',
      'JPY': 'JP',
      'CHF': 'CH',
      'CAD': 'CA',
      'AUD': 'AU',
      'NZD': 'NZ',
      'XAU': 'US', // Gold
      'XAG': 'US', // Silver
    }
    return currencyToCountry[first]
  }
  // For indices and stocks, return a default
  return 'US'
}

// Helper atom to add a tab
export const addTabAtom = atom(
  null,
  (get, set, instrumentId: string) => {
    const instruments = get(instrumentsAtom)
    const openTabs = get(openTabsAtom)

    // Find the instrument
    const instrument = instruments.find(i => i.id === instrumentId)
    if (!instrument) return

    // Check if already open
    if (openTabs.some(tab => tab.id === instrumentId)) {
      // Just switch to it
      set(activeTabIdAtom, instrumentId)
      return
    }

    // Add new tab
    const newTab: OpenTab = {
      id: instrumentId,
      symbol: instrument.symbol,
      countryCode: getCountryCodeFromSymbol(instrument.symbol)
    }

    set(openTabsAtom, [...openTabs, newTab])
    set(activeTabIdAtom, instrumentId)
  }
)

// Helper atom to remove a tab
export const removeTabAtom = atom(
  null,
  (get, set, tabId: string) => {
    const openTabs = get(openTabsAtom)
    const activeTabId = get(activeTabIdAtom)

    // Don't allow closing the last tab
    if (openTabs.length <= 1) return

    const newTabs = openTabs.filter(tab => tab.id !== tabId)
    set(openTabsAtom, newTabs)

    // If closing the active tab, switch to the last tab
    if (activeTabId === tabId) {
      set(activeTabIdAtom, newTabs[newTabs.length - 1].id)
    }
  }
)