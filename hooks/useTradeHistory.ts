"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Position } from '@/components/trading/positions-table'

interface UseTradeHistoryOptions {
  accountId: string | null
  enabled?: boolean
  fromDate?: string
  toDate?: string
  pageSize?: number | string
  page?: number | string
}

interface UseTradeHistoryReturn {
  closedPositions: Position[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useTradeHistory({ accountId, enabled = true, fromDate, toDate, pageSize, page }: UseTradeHistoryOptions): UseTradeHistoryReturn {
  console.log('[Trade History] Hook initialized', { accountId, enabled, fromDate, toDate, pageSize, page })
  
  const [closedPositions, setClosedPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const mapToPosition = (item: any, idx: number): Position => {
    
    // Handle API format from https://metaapi.zuperior.com/api/client/tradehistory/trades
    // Response structure: { DealId, OrderId, PositionId, Login, Symbol, OrderType, VolumeLots, Price, Profit, Commission, Swap, CloseTime, Comment, OpenTradeTime }
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

    // Volume handling - API uses VolumeLots (in lots)
    // Convert to display format (divide by 100 to show correct lot size)
    const rawVolume = typeof item.VolumeLots === 'number' ? item.VolumeLots : 
                     (typeof item.Volume === 'number' ? item.Volume : 
                     Number(item.VolumeLots ?? item.volumeLots ?? item.Volume ?? item.volume ?? item.VOLUME ?? 0))
    const volume = rawVolume / 100

    // Price handling - API uses Price (which is the close price)
    // For closed positions, Price is the ClosePrice, OpenTradeTime may have the open price info
    // If OpenTradeTime is null, we may not have open price - use Price as both
    const closePrice = typeof item.Price === 'number' ? item.Price : Number(
      item.Price ?? 
      item.price ?? 
      item.ClosePrice ??
      item.closePrice ?? 
      item.CLOSEPRICE ?? 
      item.PriceClose ?? 
      item.priceClose ?? 
      0
    )
    
    // OpenPrice - may not be directly available, try to get from OpenTradeTime or use closePrice as fallback
    const openPrice = typeof item.OpenPrice === 'number' ? item.OpenPrice : 
                     (closePrice > 0 ? closePrice : 0) // Fallback to closePrice if openPrice not available
    
    // Profit handling - API uses PascalCase: Profit
    const profit = typeof item.Profit === 'number' ? item.Profit : Number(item.Profit ?? item.profit ?? item.PROFIT ?? 0)
    
    // Ticket/OrderId handling - API uses OrderId or DealId
    const ticket = typeof item.OrderId === 'number' ? item.OrderId : 
                   (typeof item.DealId === 'number' ? item.DealId :
                   (item.OrderId ?? item.orderId ?? item.ORDERID ?? item.DealId ?? item.dealId ?? (idx + 1)))
    
    // Time handling - API uses CloseTime for closed positions
    // Use CloseTime as the openTime for display (since it's when the position was closed)
    let openTime = item.CloseTime ?? item.closeTime ?? item.OpenTradeTime ?? item.openTradeTime ?? item.OpenTime ?? item.openTime ?? item.TimeSetup ?? item.Time ?? new Date().toISOString()
    
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
    console.log('[Trade History] fetchHistory called', { enabled, accountId })
    
    if (!enabled || !accountId) {
      console.log('[Trade History] Skipping fetch - enabled:', enabled, 'accountId:', accountId)
      return
    }
    
    console.log('[Trade History] Starting fetch for accountId:', accountId)
    setIsLoading(true)
    setError(null)

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Build query parameters
      const params = new URLSearchParams()
      params.append('accountId', accountId)
      if (pageSize !== undefined && pageSize !== null && String(pageSize).length > 0) params.append('pageSize', String(pageSize))
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)
      if (page !== undefined && page !== null && String(page).length > 0) params.append('page', String(page))

      const apiUrl = `/apis/tradehistory/trades?${params.toString()}`
      console.log('[Trade History] Calling API:', apiUrl)
      console.log('[Trade History] Query params:', {
        accountId,
        pageSize,
        fromDate,
        toDate,
        page
      })

      // Add timeout to prevent hanging requests
      const timeoutId = setTimeout(() => {
        console.warn('[Trade History] Request timeout after 30 seconds')
        controller.abort()
      }, 30000) // 30 second timeout
      
      const res = await fetch(apiUrl, { 
        cache: 'no-store', 
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      }).finally(() => {
        clearTimeout(timeoutId)
      })
      
      console.log('[Trade History] Response received', {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        headers: Object.fromEntries(res.headers.entries())
      })
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'No response body')
        
        console.error('[Trade History] API error:', {
          status: res.status,
          statusText: res.statusText,
          error: errorText,
          accountId
        })
        
        // Handle 5xx errors gracefully - server issues shouldn't break the UI
        if (res.status >= 500 && res.status < 600) {
          setClosedPositions([]);
          setError(null);
          setIsLoading(false);
          return;
        }
        
        // Handle 503 (Service Unavailable) - token/auth issues
        if (res.status === 503) {
          setError('Failed to authenticate. Please check account credentials.');
          setClosedPositions([]);
          setIsLoading(false);
          return;
        }
        
        throw new Error(errorText || `HTTP ${res.status}`)
      }
      
      const json = await res.json().catch(() => {
        return ({} as any)
      })
      
      // Log the raw response for debugging
      console.log('[Trade History] Raw API response:', {
        success: json?.success,
        hasData: !!json?.data,
        isArray: Array.isArray(json),
        keys: json && typeof json === 'object' ? Object.keys(json) : [],
        dataType: json?.data ? (Array.isArray(json.data) ? 'array' : typeof json.data) : 'none',
        responsePreview: JSON.stringify(json).substring(0, 500)
      })
      
      // Extract trades from response - API returns { success: true, data: [...] } where data is Items array
      let items: any[] = []
      
      // Extract items from response - prioritize our API format first
      // Try ALL possible paths systematically
      if (Array.isArray(json)) {
        items = json
        console.log('[Trade History] Response is direct array, count:', items.length)
      } else if (json?.success === true && Array.isArray(json.data)) {
        items = json.data
        console.log('[Trade History] Found items in json.data (success=true), count:', items.length)
      } else if (json?.data && Array.isArray(json.data)) {
        items = json.data
        console.log('[Trade History] Found items in json.data, count:', items.length)
      } else if (Array.isArray(json?.Items)) {
        items = json.Items
        console.log('[Trade History] Found items in json.Items, count:', items.length)
      } else if (Array.isArray(json?.data?.Items)) {
        items = json.data.Items
        console.log('[Trade History] Found items in json.data.Items, count:', items.length)
      } else if (Array.isArray(json?.items)) {
        items = json.items
        console.log('[Trade History] Found items in json.items, count:', items.length)
      } else if (Array.isArray(json?.Data)) {
        items = json.Data
        console.log('[Trade History] Found items in json.Data, count:', items.length)
      } else if (Array.isArray(json?.data?.data)) {
        items = json.data.data
        console.log('[Trade History] Found items in json.data.data, count:', items.length)
      } else {
        console.warn('[Trade History] No items found in response', {
          jsonKeys: json && typeof json === 'object' ? Object.keys(json) : [],
          jsonType: typeof json,
          jsonPreview: JSON.stringify(json).substring(0, 200)
        })
      }

      // Filter out invalid trades
      // A closed position must have:
      // 1. Valid OrderId or DealId > 0
      // 2. Non-empty Symbol
      // 3. Valid Price (not 0 or undefined) - this is the close price
      // 4. Valid VolumeLots or Volume
      
      const validTrades = items.filter((item: any, index: number) => {
        const orderId = item.OrderId ?? item.orderId ?? item.DealId ?? item.dealId ?? 0
        const symbol = (item.Symbol || item.symbol || '').trim()
        const price = item.Price ?? item.price ?? item.ClosePrice ?? item.closePrice ?? item.PriceClose ?? item.priceClose ?? 0
        const volumeLots = item.VolumeLots ?? item.volumeLots ?? item.Volume ?? item.volume ?? 0
        
        // Basic validation for closed positions
        const hasValidOrderId = Number(orderId) > 0 && !isNaN(Number(orderId))
        const hasValidSymbol = symbol && symbol.length > 0
        const hasValidPrice = Number(price) > 0 && !isNaN(Number(price))
        const hasValidVolume = Number(volumeLots) > 0 && !isNaN(Number(volumeLots))
        
        return hasValidOrderId && hasValidSymbol && hasValidPrice && hasValidVolume
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
      console.log('[Trade History] Successfully fetched closed positions:', {
        accountId,
        totalItems: items.length,
        validTrades: validTrades.length,
        mappedPositions: mapped.length
      })
      
      setClosedPositions(mapped)
      setError(null) // Clear any previous errors on successful fetch
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      setError(errorMessage)
      setClosedPositions([])
    } finally {
      setIsLoading(false)
    }
  }, [accountId, enabled, fromDate, toDate, pageSize, page])

  useEffect(() => {
    console.log('[Trade History] useEffect triggered, calling fetchHistory')
    fetchHistory()
    // cleanup on unmount
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [fetchHistory])

  console.log('[Trade History] Hook returning state', {
    closedPositionsCount: closedPositions.length,
    isLoading,
    error
  })

  return { closedPositions, isLoading, error, refetch: fetchHistory }
}
