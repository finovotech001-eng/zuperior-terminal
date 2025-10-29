"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Position } from '@/components/trading/positions-table'

export type HistoryPeriod = 'today' | 'week' | 'month' | 'three-months' | 'six-months' | 'one-year' | 'all-history' | 'custom' | 'combined'

interface UseTradeHistoryOptions {
  accountId: string | null
  period?: HistoryPeriod
  from?: string
  to?: string
  enabled?: boolean
}

interface UseTradeHistoryReturn {
  closedPositions: Position[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useTradeHistory({ accountId, period = 'month', from, to, enabled = true }: UseTradeHistoryOptions): UseTradeHistoryReturn {
  const [closedPositions, setClosedPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const mapToPosition = (item: any, idx: number): Position => {
    const symbol = item.Symbol || item.symbol || ''
    const action = item.Action ?? item.action ?? item.Type ?? item.type
    let type: 'Buy' | 'Sell'
    if (action !== undefined && action !== null) {
      const n = Number(action)
      if (Number.isFinite(n)) {
        type = n === 0 ? 'Buy' : 'Sell'
      } else {
        const s = String(action).toLowerCase()
        type = s.includes('buy') ? 'Buy' : 'Sell'
      }
    } else {
      type = 'Sell'
    }
    const volRawNum = Number(item.Volume ?? item.volume ?? 0)
    let volume = volRawNum
    if (Number.isFinite(volRawNum)) {
      if (volRawNum >= 10000 && volRawNum % 10000 === 0) volume = volRawNum / 10000
      else if (volRawNum >= 100 && volRawNum % 100 === 0) volume = volRawNum / 100
      else if (volRawNum > 10000) volume = volRawNum / 10000
      else if (volRawNum > 100) volume = volRawNum / 100
    } else {
      volume = 0
    }
    const openPrice = item.PriceOpen ?? item.OpenPrice ?? item.openPrice ?? item.Price ?? 0
    const closePrice = item.PriceClose ?? item.ClosePrice ?? item.closePrice ?? item.Price ?? 0
    const profit = item.Profit ?? item.profit ?? 0
    const ticket = item.DealId ?? item.dealId ?? item.OrderId ?? item.orderId ?? idx
    const openTime = item.TimeSetup ?? item.OpenTime ?? item.openTime ?? item.Time ?? new Date().toISOString()

    return {
      id: `hist-${ticket}`,
      symbol,
      type,
      volume,
      openPrice: Number(openPrice) || 0,
      currentPrice: Number(closePrice) || 0,
      takeProfit: item.TakeProfit ?? item.takeProfit ?? undefined,
      stopLoss: item.StopLoss ?? item.stopLoss ?? undefined,
      position: String(ticket),
      openTime,
      swap: item.Swap ?? item.swap ?? 0,
      pnl: Number(profit) || 0,
    }
  }

  const fetchHistory = useCallback(async () => {
    if (!enabled || !accountId) return
    setIsLoading(true)
    setError(null)

    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const params = new URLSearchParams({ accountId, period })
      // Request all pages from server to avoid client-side pagination gaps
      params.set('all', 'true')
      params.set('pageSize', '500')
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const res = await fetch(`/apis/history?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      if (!res.ok) {
        // Handle 5xx errors gracefully - server issues shouldn't break the UI
        if (res.status >= 500 && res.status < 600) {
          console.warn(`[Trade History] Server error ${res.status} - history data temporarily unavailable`);
          setClosedPositions([]);
          setError(null); // Don't set error for server issues - just show empty history
          setIsLoading(false);
          return;
        }
        const txt = await res.text().catch(() => '')
        throw new Error(txt || `HTTP ${res.status}`)
      }
      const json = await res.json().catch(() => ({} as any))
      const data = json?.data

      // New endpoint may return an array or a paged object
      let items: any[] = []
      if (Array.isArray(data)) {
        items = data
      } else if (Array.isArray((data as any)?.items)) {
        items = (data as any).items
      } else if (Array.isArray((data as any)?.Items)) {
        items = (data as any).Items
      } else {
        // Back-compat with previous /OrdersAndDeals response
        const orders = (data as any)?.Orders && (((data as any).Orders.Items) || ((data as any).Orders.items)) || []
        const deals = (data as any)?.Deals && (((data as any).Deals.Items) || ((data as any).Deals.items)) || []
        items = Array.isArray(deals) && (deals as any[]).length > 0 ? deals : (Array.isArray(orders) ? orders : [])
      }
      const mapped: Position[] = items.map((it: any, i: number) => mapToPosition(it, i))
      setClosedPositions(mapped)
    } catch (e) {
      setError((e as Error).message)
      setClosedPositions([])
    } finally {
      setIsLoading(false)
    }
  }, [accountId, period, from, to, enabled])

  useEffect(() => {
    fetchHistory()
    // cleanup on unmount
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [fetchHistory])

  return { closedPositions, isLoading, error, refetch: fetchHistory }
}
