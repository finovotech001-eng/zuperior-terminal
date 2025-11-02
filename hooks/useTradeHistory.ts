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
    // DEBUG: Log EVERY item to see what we're actually getting
    console.log(`[Trade History] mapToPosition [${idx}] - Raw item:`, JSON.stringify(item, null, 2))
    console.log(`[Trade History] mapToPosition [${idx}] - Field check:`, {
      'item.OrderId': item.OrderId,
      'item.Symbol': item.Symbol,
      'item.Volume': item.Volume,
      'item.OpenPrice': item.OpenPrice,
      'item.ClosePrice': item.ClosePrice,
      'item.Profit': item.Profit,
      'item.OrderType': item.OrderType,
      'allKeys': Object.keys(item)
    })
    
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
    
    // DEBUG: Log the mapped position for first few items
    if (idx < 3) {
      console.log(`[Trade History] mapToPosition [${idx}] - BEFORE mapping:`, {
        rawOrderId: item.OrderId,
        rawSymbol: item.Symbol,
        rawVolume: item.Volume,
        rawOpenPrice: item.OpenPrice,
        rawClosePrice: item.ClosePrice,
        rawProfit: item.Profit,
      })
      console.log(`[Trade History] mapToPosition [${idx}] - AFTER mapping:`, {
        id: mappedPosition.id,
        ticket: mappedPosition.ticket,
        symbol: mappedPosition.symbol,
        volume: mappedPosition.volume,
        openPrice: mappedPosition.openPrice,
        currentPrice: mappedPosition.currentPrice,
        pnl: mappedPosition.pnl,
      })
    }
    
    return mappedPosition
  }

  const fetchHistory = useCallback(async () => {
    if (!enabled || !accountId) {
      console.log('[Trade History] Fetch skipped:', { enabled, accountId })
      return
    }
    console.log('[Trade History] Starting fetch for accountId:', accountId)
    setIsLoading(true)
    setError(null)

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Build query parameters - only accountId is needed
      const params = new URLSearchParams()
      params.append('accountId', accountId)

      console.log('[Trade History] Calling API:', `/apis/tradehistory/trades?${params.toString()}`)
      
      const res = await fetch(`/apis/tradehistory/trades?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      
      console.log('[Trade History] API Response Status:', res.status, res.statusText)
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'No response body')
        console.error('[Trade History] API Error:', {
          status: res.status,
          statusText: res.statusText,
          error: errorText
        })
        
        // Handle 5xx errors gracefully - server issues shouldn't break the UI
        if (res.status >= 500 && res.status < 600) {
          console.warn(`[Trade History] Server error ${res.status} - history data temporarily unavailable`);
          setClosedPositions([]);
          setError(null);
          setIsLoading(false);
          return;
        }
        throw new Error(errorText || `HTTP ${res.status}`)
      }
      
      const json = await res.json().catch((parseErr) => {
        console.error('[Trade History] JSON Parse Error:', parseErr)
        return ({} as any)
      })
      
      // DEEP DEBUG: Log the COMPLETE response structure
      console.log('[Trade History] ========== FULL RESPONSE DEBUG ==========')
      console.log('[Trade History] Response Type:', typeof json)
      console.log('[Trade History] Is Array:', Array.isArray(json))
      console.log('[Trade History] Full JSON:', JSON.stringify(json, null, 2))
      console.log('[Trade History] Response Keys:', json ? Object.keys(json) : 'null/undefined')
      
      // Check every possible field
      if (json && typeof json === 'object') {
        console.log('[Trade History] Field Check:')
        console.log('  - json.success:', json.success)
        console.log('  - json.data:', json.data, 'type:', typeof json.data, 'isArray:', Array.isArray(json.data))
        console.log('  - json.Items:', json.Items, 'type:', typeof json.Items, 'isArray:', Array.isArray(json.Items))
        console.log('  - json.items:', json.items, 'type:', typeof json.items, 'isArray:', Array.isArray(json.items))
        console.log('  - json.Data:', json.Data, 'type:', typeof json.Data, 'isArray:', Array.isArray(json.Data))
        console.log('  - json.data?.Items:', json.data?.Items, 'type:', typeof json.data?.Items, 'isArray:', Array.isArray(json.data?.Items))
        
        if (Array.isArray(json.data)) {
          console.log('  - json.data.length:', json.data.length)
          if (json.data.length > 0) {
            console.log('  - json.data[0]:', JSON.stringify(json.data[0], null, 2))
          }
        }
      }
      console.log('[Trade History] =========================================')
      
      // Extract trades from response - API returns { success: true, data: [...] } where data is Items array
      let items: any[] = []
      
      // Extract items from response - prioritize our API format first
      // Try ALL possible paths systematically
      if (Array.isArray(json)) {
        // Direct array response
        items = json
        console.log('[Trade History] ✓✓✓ EXTRACTED: Direct array response:', items.length, 'items')
      } else if (json?.success === true && Array.isArray(json.data)) {
        // Our API route wraps it in { success: true, data: [...] }
        items = json.data
        console.log('[Trade History] ✓✓✓ EXTRACTED: json.success=true && json.data array:', items.length, 'items')
      } else if (json?.data && Array.isArray(json.data)) {
        // Data field exists and is array (even if success is not true or missing)
        items = json.data
        console.log('[Trade History] ✓✓✓ EXTRACTED: json.data array (no success check):', items.length, 'items')
      } else if (Array.isArray(json?.Items)) {
        // External API format with Items array (PascalCase)
        items = json.Items
        console.log('[Trade History] ✓✓✓ EXTRACTED: json.Items array:', items.length, 'items')
      } else if (Array.isArray(json?.data?.Items)) {
        // Nested Items array
        items = json.data.Items
        console.log('[Trade History] ✓✓✓ EXTRACTED: json.data.Items array:', items.length, 'items')
      } else if (Array.isArray(json?.items)) {
        // Lowercase items
        items = json.items
        console.log('[Trade History] ✓✓✓ EXTRACTED: json.items array:', items.length, 'items')
      } else if (Array.isArray(json?.Data)) {
        // Data array (PascalCase)
        items = json.Data
        console.log('[Trade History] ✓✓✓ EXTRACTED: json.Data array:', items.length, 'items')
      } else if (Array.isArray(json?.data?.data)) {
        // Double nested data
        items = json.data.data
        console.log('[Trade History] ✓✓✓ EXTRACTED: json.data.data array:', items.length, 'items')
      } else {
        // No array found - log COMPLETE error with full structure
        console.error('[Trade History] ✗✗✗ FAILED: No items array found in response!')
        console.error('[Trade History] Full structure:', {
          type: typeof json,
          isArray: Array.isArray(json),
          keys: json ? Object.keys(json) : [],
          hasSuccess: json?.success !== undefined,
          success: json?.success,
          hasData: json?.data !== undefined,
          dataType: typeof json?.data,
          dataIsArray: Array.isArray(json?.data),
          hasItems: json?.Items !== undefined,
          itemsIsArray: Array.isArray(json?.Items),
          fullResponse: JSON.stringify(json, null, 2).substring(0, 1000)
        })
      }
      
      console.log('[Trade History] Final extracted items count:', items.length)

      // Filter out invalid trades (OrderId === 0 and empty Symbol might be pending orders or invalid)
      // DEBUG: Log filtering process
      console.log('[Trade History] ========== FILTERING DEBUG ==========')
      console.log('[Trade History] Items before filtering:', items.length)
      if (items.length > 0) {
        console.log('[Trade History] Sample item before filter:', JSON.stringify(items[0], null, 2))
      }
      
      const validTrades = items.filter((item: any, index: number) => {
        const orderId = item.OrderId ?? item.orderId ?? item.DealId ?? item.dealId ?? 0
        const symbol = (item.Symbol || item.symbol || '').trim()
        
        // STRICT FILTER: Only keep trades with valid OrderId > 0 AND non-empty Symbol
        // This filters out invalid entries with OrderId: 0 and empty Symbol
        const hasValidOrderId = Number(orderId) > 0 && !isNaN(Number(orderId))
        const hasValidSymbol = symbol && symbol.length > 0
        
        // Must have BOTH valid OrderId AND valid Symbol to be a valid trade
        const isValid = hasValidOrderId && hasValidSymbol
        
        // DEBUG: Log filtering for first few items
        if (index < 5) {
          console.log(`[Trade History] Filter check [${index}]:`, {
            orderId,
            symbol: symbol || '(empty)',
            hasValidOrderId,
            hasValidSymbol,
            isValid: isValid ? '✓ KEPT' : '✗ FILTERED OUT'
          })
        }
        
        // Log items being filtered out
        if (!isValid) {
          console.log(`[Trade History] ✗ Filtered out item ${index}: OrderId=${orderId}, Symbol="${symbol || '(empty)'}" - Missing valid OrderId or Symbol`)
        }
        
        return isValid
      })
      
      console.log('[Trade History] Items after filtering:', validTrades.length, 'valid trades out of', items.length, 'total items')
      if (validTrades.length > 0 && validTrades.length < items.length) {
        console.warn('[Trade History] ⚠ Filtered out', items.length - validTrades.length, 'items')
      }
      if (validTrades.length > 0) {
        console.log('[Trade History] Sample valid trade:', JSON.stringify(validTrades[0], null, 2))
      }
      console.log('[Trade History] =====================================')
      
      // Map to Position format with error handling
      console.log('[Trade History] ========== MAPPING DEBUG ==========')
      console.log('[Trade History] Starting to map', validTrades.length, 'valid trades to Position format')
      
      const mapped: Position[] = []
      for (let i = 0; i < validTrades.length; i++) {
        try {
          const position = mapToPosition(validTrades[i], i)
          mapped.push(position)
          if (i === 0) {
            console.log('[Trade History] First mapped position:', JSON.stringify(position, null, 2))
          }
        } catch (error) {
          console.error(`[Trade History] Error mapping item ${i}:`, error, 'Item:', validTrades[i])
          // Continue with other items even if one fails
        }
      }
      
      console.log('[Trade History] Successfully mapped:', mapped.length, 'positions out of', validTrades.length, 'trades')
      console.log('[Trade History] ===================================')
      if (mapped.length > 0) {
        console.log('[Trade History] Sample position:', {
          id: mapped[0].id,
          symbol: mapped[0].symbol,
          type: mapped[0].type,
          volume: mapped[0].volume,
          pnl: mapped[0].pnl
        })
      }
      
      // DEEP DEBUG: Log what we're about to set in state
      console.log('[Trade History] ========== BEFORE STATE UPDATE ==========')
      console.log('[Trade History] Mapped positions count:', mapped.length)
      if (mapped.length > 0) {
        console.log('[Trade History] First position full object:', JSON.stringify(mapped[0], null, 2))
        console.log('[Trade History] All positions IDs:', mapped.map(p => p.id))
      } else {
        console.warn('[Trade History] ⚠⚠⚠ WARNING: mapped array is EMPTY!')
        console.warn('[Trade History] This means either:')
        console.warn('[Trade History]   1. No items were extracted from API response')
        console.warn('[Trade History]   2. All items were filtered out as invalid')
        console.warn('[Trade History]   3. Mapping failed for all items')
        console.warn('[Trade History] Check logs above for extraction and filtering steps')
      }
      console.log('[Trade History] ==========================================')
      
      // Update state with mapped positions - always update even if empty to clear stale data
      setClosedPositions(mapped)
      setError(null) // Clear any previous errors on successful fetch
      console.log('[Trade History] ✓✓✓ STATE UPDATED with', mapped.length, 'closed positions')
      
      // Verify state update by checking after a short delay (React batches updates)
      setTimeout(() => {
        console.log('[Trade History] [DELAYED CHECK] State should now have', mapped.length, 'positions')
      }, 100)
      
      // Additional validation: ensure mapped positions have required fields
      if (mapped.length > 0) {
        const invalidPositions = mapped.filter(p => !p.id || !p.symbol || p.type === undefined)
        if (invalidPositions.length > 0) {
          console.warn('[Trade History] ⚠ Found', invalidPositions.length, 'invalid positions:', invalidPositions)
        } else {
          console.log('[Trade History] ✓ All', mapped.length, 'positions have required fields')
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      console.error('[Trade History] Fetch error:', errorMessage, e)
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
