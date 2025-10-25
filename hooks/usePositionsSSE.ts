"use client"

import { useEffect, useState, useCallback, useRef } from 'react'
import wsManager from '@/lib/websocket-service'

export interface SignalRPosition {
  id: string
  ticket: number
  symbol: string
  type: 'Buy' | 'Sell'
  volume: number
  openPrice: number
  currentPrice: number
  takeProfit?: number
  stopLoss?: number
  openTime: string
  swap: number
  profit: number
  commission: number
  comment?: string
}

interface UsePositionsProps {
  accountId: string | null
  enabled?: boolean
}

interface UsePositionsReturn {
  positions: SignalRPosition[]
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  reconnect: () => void
}

export function usePositionsSignalR({ accountId, enabled = true }: UsePositionsProps): UsePositionsReturn {
  const [positions, setPositions] = useState<SignalRPosition[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const sseRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null)
  const mounted = useRef(true)
  const connectSeq = useRef(0)
  const snapshotTimeout = useRef<NodeJS.Timeout | null>(null)

  const toPosition = (pos: any, idx?: number): SignalRPosition => {
    const rawTicket =
      pos.Ticket ?? pos.ticket ?? pos.Position ?? pos.position ??
      pos.PositionId ?? pos.PositionID ?? pos.Order ?? pos.OrderId ?? pos.id ?? pos.Id ?? 0
    const ticketNum = Number(rawTicket) || 0

    const rawVolume = pos.Volume ?? pos.volume ?? 0
    const normalizedVolume = Number(rawVolume) / 10000 // requested normalization

    const symbol = (pos.Symbol ?? pos.symbol ?? pos.SymbolName ?? '').toString()

    const t = pos.Type ?? pos.type
    const type: 'Buy' | 'Sell' = (t === 0 || t === 'Buy') ? 'Buy' : 'Sell'

    // Build a stable, unique id per row - always prefer ticket number if it exists
    let id: string
    if (ticketNum && ticketNum > 0) {
      id = `ticket-${ticketNum}`
    } else if (pos.Order ?? pos.OrderId ?? pos.PositionId ?? pos.id ?? pos.Id) {
      const alt = (pos.Order ?? pos.OrderId ?? pos.PositionId ?? pos.id ?? pos.Id).toString()
      const altNum = Number(alt)
      // If alt can be converted to a valid number, use ticket format
      if (altNum && altNum > 0) {
        id = `ticket-${altNum}`
      } else {
        id = `alt-${alt}`
      }
    } else {
      const openTimeKey = (pos.OpenTime ?? pos.openTime ?? pos.TimeSetup ?? '').toString()
      const suffix = openTimeKey ? `ot-${openTimeKey}` : `idx-${idx ?? 0}`
      id = `sym-${symbol}-${suffix}`
      // Log when we fall back to non-ticket ID
      console.warn('[SSE] Position without ticket - using fallback ID:', id, 'Raw data keys:', Object.keys(pos))
    }

    return {
      id,
      ticket: ticketNum,
      symbol,
      type,
      volume: normalizedVolume,
      openPrice: pos.OpenPrice ?? pos.openPrice ?? pos.PriceOpen ?? pos.priceOpen ?? 0,
      currentPrice: pos.PriceCurrent ?? pos.priceCurrent ?? pos.CurrentPrice ?? pos.currentPrice ?? 0,
      takeProfit: pos.TakeProfit ?? pos.takeProfit ?? pos.TP ?? pos.tp ?? undefined,
      stopLoss: pos.StopLoss ?? pos.stopLoss ?? pos.SL ?? pos.sl ?? undefined,
      openTime: pos.TimeSetup ?? pos.timeSetup ?? pos.OpenTime ?? pos.openTime ?? new Date().toISOString(),
      swap: pos.Swap ?? pos.swap ?? 0,
      profit: pos.Profit ?? pos.profit ?? 0,
      commission: pos.Commission ?? pos.commission ?? 0,
      comment: pos.Comment ?? pos.comment ?? undefined,
    }
  }

  // Authenticate and get access token
  const authenticate = useCallback(async (accId: string) => {
    try {
      console.log(`🔐 [Positions] Authenticating for account: ${accId}`)
      
      const response = await fetch('/apis/auth/mt5-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId: accId }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Authentication failed' }))
        throw new Error(errorData.message || 'Authentication failed')
      }

      const data = await response.json()
      
      if (!data.success || !data.data?.accessToken) {
        throw new Error('No access token received')
      }

      console.log(`✅ [Positions] Authentication successful for account: ${accId}`)
      return data.data.accessToken
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'
      console.error('❌ [Positions] Authentication error:', errorMessage)
      throw err
    }
  }, [])

  const connect = useCallback((accId: string, token: string) => {
    // Close any previous
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }

    setIsConnecting(true)
    setError(null)
    // Reset positions when switching account to avoid stale duplicates
    setPositions([])

    // Increment sequence to invalidate stale listeners
    connectSeq.current += 1
    const seq = connectSeq.current

    const fetchSnapshot = async () => {
      try {
        // eslint-disable-next-line no-console
        console.log('[Positions] Fetching snapshot for', accId, 'seq', seq, 'current seq:', connectSeq.current)
        const res = await fetch(`/apis/positions/snapshot?accountId=${encodeURIComponent(accId)}`, { cache: 'no-store' })
        
        if (!mounted.current) {
          console.log('[Positions] Snapshot aborted - component unmounted')
          return
        }
        if (seq !== connectSeq.current) {
          console.log('[Positions] Snapshot aborted - sequence mismatch. Expected:', connectSeq.current, 'Got:', seq)
          return
        }
        
        console.log('[Positions][DEBUG] Snapshot response status:', res.status)
        
        if (res.ok) {
          const json = await res.json().catch(() => ({} as any))
          console.log('[Positions][DEBUG] Snapshot raw response:', json)
          
          const data = json?.data
          console.log('[Positions][DEBUG] Extracted data:', data)
          console.log('[Positions][DEBUG] Data type:', Array.isArray(data) ? 'array' : typeof data)
          
          let arr: any[] = []
          if (Array.isArray(data)) arr = data
          else if (Array.isArray(data?.data)) arr = data.data
          
          console.log('[Positions][DEBUG] Final array length:', arr.length)
          
          if (Array.isArray(arr) && arr.length > 0) {
            console.log('[Positions][DEBUG] Sample position data:', arr[0])
            const mapped = arr.map((item: any, i: number) => toPosition(item, i))
            setPositions(mapped)
            // eslint-disable-next-line no-console
            console.log('[Positions] Snapshot count:', mapped.length)
          } else {
            console.log('[Positions][DEBUG] No positions in snapshot - array is empty or not an array')
          }
        } else {
          const errorText = await res.text().catch(() => 'Unable to read error')
          console.error('[Positions][ERROR] Snapshot fetch failed:', res.status, errorText)
        }
      } catch (error) {
        console.warn('[Positions] Snapshot fetch failed', error)
      }
    }

    fetchSnapshot()

    const url = `/apis/positions/stream?accountId=${encodeURIComponent(accId)}&ts=${Date.now()}`
    // eslint-disable-next-line no-console
    console.log(`[Positions][SSE] opening stream for account ${accId}, seq ${seq}, url: ${url}`)
    const es = new EventSource(url)
    sseRef.current = es

    es.onopen = () => {
      console.log('[Positions][SSE] Connection opened for seq:', seq, 'current seq:', connectSeq.current)
      if (!mounted.current) {
        console.log('[Positions][SSE] onopen ignored - unmounted')
        return
      }
      if (seq !== connectSeq.current) {
        console.log('[Positions][SSE] onopen ignored - sequence mismatch')
        return
      }
      setIsConnected(true)
      setIsConnecting(false)
      setError(null)
      console.log('[Positions][SSE] Connected successfully for account:', accId)
    }

    es.onerror = () => {
      if (!mounted.current) return
      if (seq !== connectSeq.current) return
      setIsConnected(false)
      setIsConnecting(false)
      setError('SSE connection error')
      // EventSource auto-reconnects; optional manual backoff
      if (!reconnectTimer.current) {
        reconnectTimer.current = setTimeout(() => {
          reconnectTimer.current = null
          if (mounted.current && accountId && seq === connectSeq.current) {
            // Re-authenticate before reconnecting
            console.log('🔄 [Positions] Re-authenticating after error...')
            authenticate(accountId)
              .then(newToken => {
                setAccessToken(newToken)
                connect(accountId, newToken)
              })
              .catch(err => {
                console.error('❌ [Positions] Re-authentication failed:', err)
                setError(err instanceof Error ? err.message : 'Re-authentication failed')
              })
          }
        }, 5000)
      }
    }

    es.onmessage = (evt) => {
      if (!mounted.current) {
        console.log('[Positions][SSE] Message ignored - component unmounted')
        return
      }
      if (seq !== connectSeq.current) {
        console.log('[Positions][SSE] Message ignored - sequence mismatch. Expected:', connectSeq.current, 'Got:', seq)
        return
      }
      try {
        const msg = JSON.parse(evt.data)
        const type = msg?.type || 'positions'
        
        console.log('[Positions][SSE] Received message type:', type, 'seq:', seq)
        
        if (type === 'debug') {
          // Surface server debug messages to help validate flow
          // e.g., which method supplied the snapshot
          // eslint-disable-next-line no-console
          console.log('[Positions][DEBUG]', msg?.data)
          return
        }
        const data = msg?.data
        
        if (type === 'closed') {
          const ticket = (data?.Ticket || data?.ticket || data) as number
          console.log('[Positions][SSE] Position closed, ticket:', ticket)
          if (!ticket) return
          setPositions(prev => prev.filter(p => p.ticket !== ticket))
          return
        }

        // Helper to extract array from various payload shapes (handles nested wrappers)
        const extractArray = (obj: any): any[] | null => {
          if (!obj) return null
          if (Array.isArray(obj)) return obj
          // Direct candidates
          const direct = [
            obj.Positions, obj.positions,
            obj.Items, obj.items,
            obj.Records, obj.records,
            obj.Data, obj.data,
            obj.Result, obj.result,
          ]
          for (const c of direct) {
            if (Array.isArray(c)) return c
          }
          // Nested common wrappers
          const nest1 = obj.Data || obj.data || obj.Result || obj.result
          if (nest1) {
            const inner = [
              nest1.Positions, nest1.positions,
              nest1.Items, nest1.items,
              nest1.Records, nest1.records,
              nest1.Data, nest1.data,
            ]
            for (const c of inner) {
              if (Array.isArray(c)) return c
            }
          }
          return null
        }

        // If we can't extract array but got an object, surface keys to help debugging
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          // eslint-disable-next-line no-console
          console.log('[Positions][DEBUG] event object keys:', Object.keys(data))
        }

        const arr = extractArray(data)
        if (arr) {
          console.log('[Positions][SSE] Extracted array with', arr.length, 'items')
          if (arr.length > 0) {
            console.log('[Positions][SSE] Sample raw position:', arr[0])
          }
          
          // Replace with the latest snapshot exactly as provided (no dedupe)
          const mapped = arr.map((item, i) => toPosition(item, i))
          setPositions(mapped)
          // eslint-disable-next-line no-console
          console.log('[Positions] Snapshot count:', mapped.length, 'tickets:', mapped.map(p => p.ticket))
          if (snapshotTimeout.current) { clearTimeout(snapshotTimeout.current); snapshotTimeout.current = null }
          return
        }

        console.log('[Positions][SSE] Could not extract array, raw data:', data)

        if (data && typeof data === 'object') {
          console.log('[Positions][SSE] Processing single position update')
          const p = toPosition(data)
          console.log('[Positions][SSE] Mapped position:', p)
          setPositions(prev => {
            const byTicket = new Map<number, SignalRPosition>()
            for (const x of prev) if (x.ticket) byTicket.set(x.ticket, x)
            if (p.ticket) byTicket.set(p.ticket, p)
            return Array.from(byTicket.values())
          })
        }
      } catch (err) {
        console.error('[Positions][SSE] Error processing message:', err)
      }
    }
  }, [accountId, authenticate])

  const reconnect = useCallback(() => {
    if (!accountId) return
    
    console.log('🔄 [Positions] Reconnecting...')
    setError(null)
    
    // Re-authenticate and connect
    authenticate(accountId)
      .then(token => {
        setAccessToken(token)
        // Also set token for live data/chart hubs
        try { wsManager.setToken(token) } catch {}
        return connect(accountId, token)
      })
      .catch(err => {
        console.error('❌ [Positions] Reconnect failed:', err)
        setError(err instanceof Error ? err.message : 'Reconnection failed')
      })
  }, [accountId, authenticate, connect])

  useEffect(() => {
    if (!enabled || !accountId) {
      // Clean up when disabled or no account
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
      if (snapshotTimeout.current) {
        clearTimeout(snapshotTimeout.current)
        snapshotTimeout.current = null
      }
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      setPositions([])
      setIsConnected(false)
      setIsConnecting(false)
      return
    }

    // IMPORTANT: Clean up existing connection BEFORE starting new one
    console.log(`🔄 [Positions] Account changed to: ${accountId}`)
    
    // Close old connection immediately
    if (sseRef.current) {
      console.log('[Positions] Closing previous SSE connection')
      sseRef.current.close()
      sseRef.current = null
    }
    
    // Clear any pending timers
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
    if (snapshotTimeout.current) {
      clearTimeout(snapshotTimeout.current)
      snapshotTimeout.current = null
    }
    
    // Reset state
    setPositions([])
    setIsConnected(false)
    setError(null)

    // Small delay to ensure cleanup completes before starting new connection
    const switchTimeout = setTimeout(() => {
      // Authenticate and connect
    authenticate(accountId)
      .then(token => {
        setAccessToken(token)
        try { wsManager.setToken(token) } catch {}
        return connect(accountId, token)
      })
        .catch(err => {
          console.error('❌ [Positions] Initial connection failed:', err)
          setError(err instanceof Error ? err.message : 'Connection failed')
          setIsConnecting(false)
        })
    }, 100)

    return () => {
      clearTimeout(switchTimeout)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (snapshotTimeout.current) clearTimeout(snapshotTimeout.current)
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
    }
  }, [accountId, enabled, authenticate, connect])

  useEffect(() => {
    mounted.current = true
  }, [accountId]) // Reset mounted flag when account changes
  
  useEffect(() => {
    return () => { mounted.current = false }
  }, [])

  return { positions, isConnected, isConnecting, error, reconnect }
}
