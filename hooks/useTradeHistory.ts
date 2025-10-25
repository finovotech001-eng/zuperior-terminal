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
    const action = item.Action ?? item.action
    const type = (action === 0 || action === 'Buy') ? 'Buy' as const : 'Sell' as const
    const volRaw = item.Volume ?? item.volume ?? 0
    const volume = Number(volRaw) / 10000
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
      if (from) params.set('from', from)
      if (to) params.set('to', to)

      const res = await fetch(`/apis/history?${params.toString()}`, { cache: 'no-store', signal: controller.signal })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || `HTTP ${res.status}`)
      }
      const json = await res.json().catch(() => ({} as any))
      const data = json?.data || {}
      const orders = (data.Orders && (data.Orders.Items || data.Orders.items)) || []
      const deals = (data.Deals && (data.Deals.Items || data.Deals.items)) || []

      // Prefer deals for closed trades
      const items = Array.isArray(deals) && deals.length > 0 ? deals : (Array.isArray(orders) ? orders : [])
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

