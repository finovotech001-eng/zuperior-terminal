import type { Instrument } from '@/components/trading/instrument-list'

/**
 * Check if weekend trading restriction is currently active
 * Restriction is active from Saturday 00:00 UTC to Monday 00:00 UTC
 * @returns true if restriction is active (Saturday or Sunday in UTC)
 */
export function isWeekendRestrictionActive(): boolean {
  const now = new Date()
  const utcDay = now.getUTCDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const utcHour = now.getUTCHours()
  const utcMinute = now.getUTCMinutes()
  
  // Log for debugging
  console.log('[Weekend Check]', {
    utcDay,
    utcHour,
    utcMinute,
    utcTime: now.toISOString(),
    dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][utcDay]
  })
  
  // Saturday (day 6) from 00:00 UTC onwards - entire day
  if (utcDay === 6) {
    console.log('[Weekend Check] Saturday detected - restriction ACTIVE')
    return true
  }
  
  // Sunday (day 0) - entire day
  if (utcDay === 0) {
    console.log('[Weekend Check] Sunday detected - restriction ACTIVE')
    return true
  }
  
  // Monday (day 1) - restriction ends at 00:00 UTC
  // At Monday 00:00:00 UTC, restriction should end
  // So if it's Monday and hour is 0 and minute is 0, restriction ends
  // But if it's Monday and hour > 0, definitely not restricted
  if (utcDay === 1 && utcHour === 0 && utcMinute === 0) {
    console.log('[Weekend Check] Monday 00:00 UTC - restriction ENDS')
    return false
  }
  
  console.log('[Weekend Check] Not weekend - restriction INACTIVE')
  return false
}

/**
 * Check if a symbol is a crypto currency
 * @param symbol - The trading symbol (e.g., "BTCUSD", "ETHUSD", "XAUUSD")
 * @param instruments - List of instruments to check category from
 * @returns true if symbol is crypto
 */
export function isCryptoSymbol(symbol: string, instruments: Instrument[]): boolean {
  if (!symbol) return false
  
  const symbolUpper = symbol.toUpperCase()
  const symbolNormalized = symbolUpper.replace('/', '').replace('m', '')
  
  // First, try to find in instruments list and check category
  const instrument = instruments.find(
    inst => inst.symbol.toUpperCase() === symbolUpper || 
            inst.symbol.toUpperCase().replace('/', '') === symbolNormalized ||
            inst.symbol.toUpperCase().replace('/', '').replace('M', '') === symbolNormalized
  )
  
  if (instrument && instrument.category === 'crypto') {
    return true
  }
  
  // Fallback to pattern matching
  // ONLY BTC and ETH are considered crypto - nothing else
  // Metals (XAU, XAG) are NOT crypto and should be blocked on weekends
  if (symbolUpper.startsWith('BTC') || symbolUpper.startsWith('ETH')) {
    return true
  }
  
  // Explicitly exclude metals (they should be blocked on weekends)
  if (symbolUpper.startsWith('XAU') || symbolUpper.startsWith('XAG')) {
    return false
  }
  
  // No other symbols are considered crypto for weekend trading
  return false
}

/**
 * Check if trading is allowed for a symbol during weekend
 * @param symbol - The trading symbol
 * @param instruments - List of instruments
 * @returns true if trading is allowed (i.e., symbol is crypto)
 */
export function canTradeOnWeekend(symbol: string, instruments: Instrument[]): boolean {
  return isCryptoSymbol(symbol, instruments)
}

