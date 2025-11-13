"use client"

import { useEffect, useState, useCallback, useRef } from 'react'

export interface PendingOrder {
  id: string
  ticket: number
  symbol: string
  type: 'Buy' | 'Sell'
  volume: number
  price: number // PriceOrder
  priceCurrent?: number // PriceCurrent
  takeProfit?: number // PriceTP
  stopLoss?: number // PriceSL
  expiration?: string
  comment?: string
  openTime: string
}

interface UsePendingOrdersProps {
  accountId: string | null
  enabled?: boolean
  pollInterval?: number // Polling interval in milliseconds
}

interface UsePendingOrdersReturn {
  pendingOrders: PendingOrder[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function usePendingOrders({ 
  accountId, 
  enabled = true,
  pollInterval = 3000 // Default 3 seconds
}: UsePendingOrdersProps): UsePendingOrdersReturn {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const accessTokenRef = useRef<string | null>(null)

  // Authenticate and get access token
  const authenticate = useCallback(async (accId: string) => {
    try {
      console.log(`🔐 [PendingOrders] Authenticating for account: ${accId}`)
      
      const response = await fetch('/apis/auth/mt5-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId: accId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Authentication failed' }))
        throw new Error(errorData?.message || `HTTP ${response.status}`)
      }

      const data = await response.json()
      const token = data?.data?.accessToken || data?.accessToken || data?.AccessToken || data?.Token
      
      if (!token) {
        throw new Error('No access token received')
      }
      
      accessTokenRef.current = token
      return token
    } catch (err) {
      console.error('[PendingOrders] Authentication error:', err)
      throw err
    }
  }, [])

  // Fetch pending orders
  const fetchPendingOrders = useCallback(async (accId: string) => {
    if (!mounted.current) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Get access token
      let token = accessTokenRef.current
      if (!token) {
        token = await authenticate(accId)
      }

      // Build URL with access token
      const url = `/apis/orders/pending?accountId=${encodeURIComponent(accId)}&accessToken=${encodeURIComponent(token)}`
      
      console.log('[PendingOrders] Fetching pending orders from:', url)
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
      
      try {
        const res = await fetch(url, { 
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!mounted.current) return
        
        if (!res.ok) {
          const errorText = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`)
        }
        
        const json = await res.json().catch(() => ({} as any))
        
        console.log('═══════════════════════════════════════════════════════════')
        console.log('[PendingOrders] 📥 RAW API RESPONSE FROM /client/orders')
        console.log('═══════════════════════════════════════════════════════════')
        console.log('📋 Complete Response:', JSON.stringify(json, null, 2))
        console.log('🔑 Response Keys:', Object.keys(json || {}))
        console.log('───────────────────────────────────────────────────────────')
        
        if (!mounted.current) return
        
        // Extract pending orders array from response
        // The /client/orders endpoint may return different structures
        let ordersArray: any[] = []
        
        // Handle different response formats
        if (Array.isArray(json)) {
          // Direct array response
          ordersArray = json
          console.log('[PendingOrders] ✅ Found direct array in response')
        } else if (Array.isArray(json?.data)) {
          ordersArray = json.data
          console.log('[PendingOrders] ✅ Found array in json.data')
        } else if (Array.isArray(json?.Data)) {
          ordersArray = json.Data
          console.log('[PendingOrders] ✅ Found array in json.Data')
        } else if (Array.isArray(json?.result)) {
          ordersArray = json.result
          console.log('[PendingOrders] ✅ Found array in json.result')
        } else if (Array.isArray(json?.Result)) {
          ordersArray = json.Result
          console.log('[PendingOrders] ✅ Found array in json.Result')
        } else if (Array.isArray(json?.orders)) {
          ordersArray = json.orders
          console.log('[PendingOrders] ✅ Found array in json.orders')
        } else if (Array.isArray(json?.Orders)) {
          ordersArray = json.Orders
          console.log('[PendingOrders] ✅ Found array in json.Orders')
        } else if (json?.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
          // Try nested data structures
          if (Array.isArray(json.data.data)) {
            ordersArray = json.data.data
            console.log('[PendingOrders] ✅ Found array in json.data.data')
          } else if (Array.isArray(json.data.Data)) {
            ordersArray = json.data.Data
            console.log('[PendingOrders] ✅ Found array in json.data.Data')
          } else if (Array.isArray(json.data.orders)) {
            ordersArray = json.data.orders
            console.log('[PendingOrders] ✅ Found array in json.data.orders')
          } else if (Array.isArray(json.data.Orders)) {
            ordersArray = json.data.Orders
            console.log('[PendingOrders] ✅ Found array in json.data.Orders')
          }
        }
        
        console.log('[PendingOrders] Extracted orders array length:', ordersArray.length)
        if (ordersArray.length > 0) {
          console.log('[PendingOrders] Sample order structure:', JSON.stringify(ordersArray[0], null, 2))
        }
        console.log('═══════════════════════════════════════════════════════════')
        
        // Filter for pending orders only (orders that are not yet executed/closed)
        // Pending orders typically have OrderType that indicates pending status
        // Common pending order types: Buy Limit, Sell Limit, Buy Stop, Sell Stop
        const pendingOnlyArray = ordersArray.filter((order: any) => {
          // Check if order is pending based on various indicators
          const orderType = order.OrderType ?? order.orderType ?? order.Type ?? order.type
          const orderState = order.State ?? order.state ?? order.Status ?? order.status
          
          // If we have an order type that indicates pending (not 0 for market orders)
          // or if state/status indicates pending
          const isPending = 
            (orderType !== undefined && orderType !== null && orderType !== 0) || // Non-zero order types are usually pending
            (orderState === 'pending' || orderState === 'Pending' || orderState === 0 || orderState === 'Open') ||
            (order.TimeExpiration && new Date(order.TimeExpiration) > new Date()) // Has expiration in future
          
          return isPending !== false // Default to true if we can't determine
        })
        
        console.log('[PendingOrders] Filtered pending orders:', pendingOnlyArray.length, 'out of', ordersArray.length, 'total orders')
        
        // Map to PendingOrder format
        const mappedOrders: PendingOrder[] = pendingOnlyArray.map((order: any, index: number) => {
          // Extract ticket/order ID
          const rawTicket = order.OrderId ?? order.orderId ?? order.Ticket ?? order.ticket ?? 
                           order.PositionId ?? order.positionId ?? order.Id ?? order.id ?? 0
          const ticketNum = Number(rawTicket) || (index + 1)
          
          // Extract symbol
          const symbol = (order.Symbol ?? order.symbol ?? order.SymbolName ?? '').toString()
          
          // Extract order type (MT5: 0 = Buy, 1 = Sell, 2 = Buy Limit, 3 = Sell Limit, 4 = Buy Stop, 5 = Sell Stop)
          // Even numbers (0,2,4) are Buy types, odd numbers (1,3,5) are Sell types
          const rawType = order.OrderType ?? order.orderType ?? order.Type ?? order.type ?? 
                         order.Action ?? order.action ?? order.Cmd ?? order.cmd ?? 1
          let type: 'Buy' | 'Sell' = 'Sell'
          if (typeof rawType === 'number') {
            // Even numbers = Buy, Odd numbers = Sell
            type = (rawType % 2 === 0) ? 'Buy' : 'Sell'
          } else {
            const typeStr = String(rawType).toLowerCase()
            type = typeStr.includes('buy') ? 'Buy' : 'Sell'
          }
          
          // Extract volume (normalize from raw volume)
          // API might return volume in different formats, check if already normalized
          const rawVolume = order.Volume ?? order.volume ?? 0
          // If volume is less than 1, assume it's already in lots, otherwise divide by 10000
          const volume = rawVolume < 1 ? Number(rawVolume) : Number(rawVolume) / 10000
          
          // Extract PriceOrder (order price for pending orders)
          const priceOrder = Number(order.PriceOrder ?? order.priceOrder ?? order.Price ?? order.price ?? order.OpenPrice ?? order.openPrice ?? 0)
          
          // Extract PriceCurrent (current market price)
          const priceCurrent = Number(order.PriceCurrent ?? order.priceCurrent ?? order.CurrentPrice ?? order.currentPrice ?? priceOrder)
          
          // Extract PriceTP and PriceSL (specific field names from this API)
          const priceTP = order.PriceTP ?? order.priceTP ?? order.TakeProfit ?? order.takeProfit ?? order.TP ?? order.tp
          const priceSL = order.PriceSL ?? order.priceSL ?? order.StopLoss ?? order.stopLoss ?? order.SL ?? order.sl
          
          // Extract expiration
          const expiration = order.Expiration ?? order.expiration ?? order.Expiry ?? order.expiry
          
          // Extract comment
          const comment = order.Comment ?? order.comment
          
          // Extract time
          const openTime = order.TimeSetup ?? order.timeSetup ?? order.OpenTime ?? order.openTime ?? 
                          order.Time ?? order.time ?? new Date().toISOString()
          
          const mapped: PendingOrder = {
            id: `pending-${ticketNum}`,
            ticket: ticketNum,
            symbol,
            type,
            volume,
            price: priceOrder, // Use PriceOrder as the order price
            priceCurrent: priceCurrent, // Store current price separately
            takeProfit: priceTP !== undefined && priceTP !== null && Number(priceTP) > 0 ? Number(priceTP) : undefined,
            stopLoss: priceSL !== undefined && priceSL !== null && Number(priceSL) > 0 ? Number(priceSL) : undefined,
            expiration: expiration ? String(expiration) : undefined,
            comment: comment ? String(comment) : undefined,
            openTime: String(openTime),
          }
          
          console.log(`[PendingOrders] Mapped order [${index}]:`, {
            symbol: mapped.symbol,
            type: mapped.type,
            priceOrder: mapped.price,
            priceCurrent: mapped.priceCurrent,
            priceTP: mapped.takeProfit,
            priceSL: mapped.stopLoss,
            volume: mapped.volume,
            rawType: rawType
          })
          
          return mapped
        })
        
        console.log('[PendingOrders] ✅ Successfully fetched and mapped', mappedOrders.length, 'pending orders')
        
        if (mounted.current) {
          setPendingOrders(mappedOrders)
          setIsLoading(false)
          setError(null)
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)
        if (fetchErr.name === 'AbortError') {
          throw new Error('Request timeout - server took too long to respond')
        }
        throw fetchErr
      }
    } catch (err) {
      console.error('[PendingOrders] ❌ Error fetching pending orders:', err)
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pending orders')
        setIsLoading(false)
        // Clear token on error to force re-auth next time
        accessTokenRef.current = null
      }
    }
  }, [authenticate])

  // Refresh function
  const refresh = useCallback(() => {
    if (accountId && enabled) {
      fetchPendingOrders(accountId)
    }
  }, [accountId, enabled, fetchPendingOrders])

  // Setup polling effect
  useEffect(() => {
    if (!accountId || !enabled) {
      setPendingOrders([])
      setIsLoading(false)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Initial fetch
    fetchPendingOrders(accountId)

    // Setup polling interval
    intervalRef.current = setInterval(() => {
      if (mounted.current && accountId) {
        fetchPendingOrders(accountId)
      }
    }, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [accountId, enabled, pollInterval, fetchPendingOrders])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mounted.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    pendingOrders,
    isLoading,
    error,
    refresh,
  }
}

