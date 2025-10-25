"use client"

import { useEffect, useState, useCallback, useRef } from 'react'

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

    // Build a stable, unique id per row
    let id: string
    if (ticketNum > 0) {
      id = `ticket-${ticketNum}`
    } else if (pos.Order ?? pos.OrderId ?? pos.PositionId ?? pos.id ?? pos.Id) {
      const alt = (pos.Order ?? pos.OrderId ?? pos.PositionId ?? pos.id ?? pos.Id).toString()
      id = `alt-${alt}`
    } else {
      const openTimeKey = (pos.OpenTime ?? pos.openTime ?? pos.TimeSetup ?? '').toString()
      const suffix = openTimeKey ? `ot-${openTimeKey}` : `idx-${idx ?? 0}`
      id = `sym-${symbol}-${suffix}`
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

  const connect = useCallback((accId: string) => {
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

    const url = `/apis/positions/stream?accountId=${encodeURIComponent(accId)}&ts=${Date.now()}`
    // eslint-disable-next-line no-console
    console.log(`[Positions][SSE] opening stream for account ${accId}, seq ${seq}, url: ${url}`)
    const es = new EventSource(url)
    sseRef.current = es

    es.onopen = () => {
      if (!mounted.current) return
      if (seq !== connectSeq.current) return
      setIsConnected(true)
      setIsConnecting(false)
      setError(null)
      // If we don't receive a snapshot quickly, force a reconnect
      if (snapshotTimeout.current) clearTimeout(snapshotTimeout.current)
      snapshotTimeout.current = setTimeout(() => {
        if (!mounted.current) return
        if (seq !== connectSeq.current) return
        console.warn('[Positions] No snapshot yet, forcing reconnect')
        es.close()
        sseRef.current = null
        connect(accId)
      }, 7000)
    }

    es.onerror = () => {
      if (!mounted.current) return
      if (seq !== connectSeq.current) return
      setIsConnected(false)
      setIsConnecting(false)
      setError('SSE connection error')
      if (snapshotTimeout.current) { clearTimeout(snapshotTimeout.current); snapshotTimeout.current = null }
      // EventSource auto-reconnects; optional manual backoff
      if (!reconnectTimer.current) {
        reconnectTimer.current = setTimeout(() => {
          reconnectTimer.current = null
          if (mounted.current && accountId && seq === connectSeq.current) connect(accountId)
        }, 5000)
      }
    }

    es.onmessage = (evt) => {
      if (!mounted.current) return
      if (seq !== connectSeq.current) return
      try {
        const msg = JSON.parse(evt.data)
        const type = msg?.type || 'positions'
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
          // Replace with the latest snapshot exactly as provided (no dedupe)
          const mapped = arr.map((item, i) => toPosition(item, i))
          setPositions(mapped)
          // eslint-disable-next-line no-console
          console.log('[Positions] Snapshot count:', mapped.length, 'tickets:', mapped.map(p => p.ticket))
          if (snapshotTimeout.current) { clearTimeout(snapshotTimeout.current); snapshotTimeout.current = null }
          return
        }

        if (data && typeof data === 'object') {
          const p = toPosition(data)
          setPositions(prev => {
            const byTicket = new Map<number, SignalRPosition>()
            for (const x of prev) if (x.ticket) byTicket.set(x.ticket, x)
            if (p.ticket) byTicket.set(p.ticket, p)
            return Array.from(byTicket.values())
          })
        }
      } catch {}
    }
  }, [accountId])

  const reconnect = useCallback(() => {
    if (accountId) connect(accountId)
  }, [accountId, connect])

  useEffect(() => {
    if (!enabled || !accountId) {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null }
      setPositions([])
      setIsConnected(false)
      setIsConnecting(false)
      return
    }

    connect(accountId)

    return () => {
      mounted.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null }
    }
  }, [accountId, enabled, connect])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  return { positions, isConnected, isConnecting, error, reconnect }
}
