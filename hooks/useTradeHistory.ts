"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Position } from '@/components/trading/positions-table'

interface UseTradeHistoryOptions {
  accountId: string | null
  enabled?: boolean
}

interface UseTradeHistoryReturn {
  closedPositions: Position[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useTradeHistory({ accountId, enabled = true }: UseTradeHistoryOptions): UseTradeHistoryReturn {
  const [closedPositions, setClosedPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const mapToPosition = (item: any, idx: number): Position => {
    
    // Handle new API format: { OrderId, Symbol, OrderType, Volume, OpenPrice, ClosePrice, TakeProfit, StopLoss, Profit }
    // API uses PascalCase - use those directly first, then fallback
    const symbol = String(item.Symbol || item.symbol || item.SYMBOL || '').trim()
    
    // Handle OrderType field (buy, sell, buy limit, sell limit, buy stop, sell stop, unknown)
    const orderType = item.OrderType || item.orderType || item.Action || item.action || item.Type || item.type || ''
    let type: 'Buy' | 'Sell'
    if (orderType) {
      const typeStr = String(orderType).toLowerCase()
      if (typeStr.includes('buy')) {
        type = 'Buy'
      } else if (typeStr.includes('sell')) {
        type = 'Sell'
      } else {
        // Fallback: try numeric values
        const n = Number(orderType)
        type = Number.isFinite(n) && n === 0 ? 'Buy' : 'Sell'
      }
    } else {
      type = 'Sell' // Default fallback
    }

    // Volume handling - API uses PascalCase: Volume
    // API returns volume in lots (e.g., 0.001, 0.00101)
    // Multiply by 1000 to convert to display format
    const rawVolume = typeof item.Volume === 'number' ? item.Volume : Number(item.Volume ?? item.volume ?? item.VOLUME ?? 0)
    const volume = rawVolume * 1000

    // Price handling - API uses PascalCase: OpenPrice, ClosePrice
    const openPrice = typeof item.OpenPrice === 'number' ? item.OpenPrice : Number(
      item.OpenPrice ?? 
      item.openPrice ?? 
      item.OPENPRICE ?? 
      item.PriceOpen ?? 
      item.priceOpen ?? 
      0
    )
    const closePrice = typeof item.ClosePrice === 'number' ? item.ClosePrice : Number(
      item.ClosePrice ?? 
      item.closePrice ?? 
      item.CLOSEPRICE ?? 
      item.PriceClose ?? 
      item.priceClose ?? 
      0
    )
    
    // Profit handling - API uses PascalCase: Profit
    const profit = typeof item.Profit === 'number' ? item.Profit : Number(item.Profit ?? item.profit ?? item.PROFIT ?? 0)
    
    // Ticket/OrderId handling - API uses PascalCase: OrderId
    const ticket = typeof item.OrderId === 'number' ? item.OrderId : (item.OrderId ?? item.orderId ?? item.ORDERID ?? item.DealId ?? item.dealId ?? (idx + 1))
    
    // Time handling - may not be present in new API, use current time as fallback
    // Format the time properly for display
    let openTime = item.OpenTime ?? item.openTime ?? item.TimeSetup ?? item.Time ?? new Date().toISOString()
    
    // If it's a date string, format it; if it's already formatted, use it as-is
    try {
      if (typeof openTime === 'string' && openTime.length > 0) {
        // Try to parse and format if it's an ISO string or date
        const date = new Date(openTime)
        if (!isNaN(date.getTime())) {
          // Format as readable date/time
          openTime = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          })
        }
      } else if (typeof openTime === 'number') {
        // If it's a timestamp, convert it
        const date = new Date(openTime)
        openTime = date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      }
    } catch {
      // If formatting fails, use the original value or a fallback
      openTime = openTime || new Date().toLocaleDateString()
    }
    
    // TP/SL from new API
    const takeProfit = item.TakeProfit ?? item.takeProfit ?? undefined
    const stopLoss = item.StopLoss ?? item.stopLoss ?? undefined

    // Ensure we have valid numbers - check for NaN and handle properly
    const finalVolume = (typeof volume === 'number' && !isNaN(volume) && isFinite(volume)) ? volume : 0
    const finalOpenPrice = (typeof openPrice === 'number' && !isNaN(openPrice) && isFinite(openPrice)) ? openPrice : 0
    const finalClosePrice = (typeof closePrice === 'number' && !isNaN(closePrice) && isFinite(closePrice)) ? closePrice : 0
    const finalProfit = (typeof profit === 'number' && !isNaN(profit) && isFinite(profit)) ? profit : 0
    const finalTicket = (typeof ticket === 'number' && !isNaN(ticket) && ticket > 0) ? ticket : undefined
    
    const mappedPosition = {
      id: `hist-${finalTicket || idx}`,
      ticket: finalTicket,
      symbol: symbol || 'N/A',
      type,
      volume: finalVolume,
      openPrice: finalOpenPrice,
      currentPrice: finalClosePrice,
      takeProfit: takeProfit !== undefined && takeProfit !== null && takeProfit !== 0 ? Number(takeProfit) : undefined,
      stopLoss: stopLoss !== undefined && stopLoss !== null && stopLoss !== 0 ? Number(stopLoss) : undefined,
      position: String(finalTicket || (idx + 1)),
      openTime,
      swap: Number(item.Swap ?? item.swap ?? 0) || 0,
      pnl: finalProfit,
    }
    
    
    return mappedPosition
  }

  const fetchHistory = useCallback(async () => {
    if (!enabled || !accountId) {
      return
    }
    setIsLoading(true)
    setError(null)

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Build query parameters - only accountId is needed
      const params = new URLSearchParams()
      params.append('accountId', accountId)

      const res = await fetch(`/apis/tradehistory/trades?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'No response body')
        
        // Handle 5xx errors gracefully - server issues shouldn't break the UI
        if (res.status >= 500 && res.status < 600) {
          setClosedPositions([]);
          setError(null);
          setIsLoading(false);
          return;
        }
        throw new Error(errorText || `HTTP ${res.status}`)
      }
      
      const json = await res.json().catch(() => {
        return ({} as any)
      })
      
      // Extract trades from response - API returns { success: true, data: [...] } where data is Items array
      let items: any[] = []
      
      // Extract items from response - prioritize our API format first
      // Try ALL possible paths systematically
      if (Array.isArray(json)) {
        items = json
      } else if (json?.success === true && Array.isArray(json.data)) {
        items = json.data
      } else if (json?.data && Array.isArray(json.data)) {
        items = json.data
      } else if (Array.isArray(json?.Items)) {
        items = json.Items
      } else if (Array.isArray(json?.data?.Items)) {
        items = json.data.Items
      } else if (Array.isArray(json?.items)) {
        items = json.items
      } else if (Array.isArray(json?.Data)) {
        items = json.Data
      } else if (Array.isArray(json?.data?.data)) {
        items = json.data.data
      }

      // Filter out invalid trades - server already filters for non-zero profit
      // A closed position must have:
      // 1. Valid OrderId > 0
      // 2. Non-empty Symbol
      // 3. Valid ClosePrice (not 0 or undefined) - this indicates the position is actually closed
      
      const validTrades = items.filter((item: any, index: number) => {
        const orderId = item.OrderId ?? item.orderId ?? item.DealId ?? item.dealId ?? 0
        const symbol = (item.Symbol || item.symbol || '').trim()
        const closePrice = item.ClosePrice ?? item.closePrice ?? item.PriceClose ?? item.priceClose ?? 0
        const openPrice = item.OpenPrice ?? item.openPrice ?? item.PriceOpen ?? item.priceOpen ?? 0
        
        // Basic validation for closed positions
        const hasValidOrderId = Number(orderId) > 0 && !isNaN(Number(orderId))
        const hasValidSymbol = symbol && symbol.length > 0
        const hasValidClosePrice = Number(closePrice) > 0 && !isNaN(Number(closePrice))
        const hasValidOpenPrice = Number(openPrice) > 0 && !isNaN(Number(openPrice))
        
        return hasValidOrderId && hasValidSymbol && hasValidClosePrice && hasValidOpenPrice
      })
      
      // Map to Position format with error handling
      const mapped: Position[] = []
      for (let i = 0; i < validTrades.length; i++) {
        try {
          const position = mapToPosition(validTrades[i], i)
          mapped.push(position)
        } catch (error) {
          // Continue with other items even if one fails
        }
      }
      
      // Update state with mapped positions - always update even if empty to clear stale data
      setClosedPositions(mapped)
      setError(null) // Clear any previous errors on successful fetch
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      setError(errorMessage)
      setClosedPositions([])
    } finally {
      setIsLoading(false)
    }
  }, [accountId, enabled])

  useEffect(() => {
    fetchHistory()
    // cleanup on unmount
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [fetchHistory])

  return { closedPositions, isLoading, error, refetch: fetchHistory }
}
