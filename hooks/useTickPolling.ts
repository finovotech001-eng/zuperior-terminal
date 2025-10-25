"use client"

import { useEffect, useMemo, useRef, useState } from 'react'

export interface Tick {
  symbol: string
  bid: number
  ask: number
  spread?: number
  ts?: number
}

/**
 * Poll tick REST endpoint for a small set of symbols.
 * Uses the debug proxy: /apis/debug/tick?symbol=SYMBOL
 * Returns a Map<symbol, Tick> with the latest values.
 */
export function useTickPolling(symbols: string[], intervalMs = 800) {
  const [ticks, setTicks] = useState<Map<string, Tick>>(new Map())
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const uniqueSymbols = useMemo(() => {
    // Deduplicate symbols and limit to 20 to avoid spamming the API.
    const set = Array.from(new Set(symbols.filter(Boolean)))
    return set.slice(0, 20)
  }, [symbols.join(',')])

  useEffect(() => {
    const fetchOnce = async () => {
      if (uniqueSymbols.length === 0) return
      try {
        const results = await Promise.all(
          uniqueSymbols.map(async (s) => {
            const url = `/apis/debug/tick?symbol=${encodeURIComponent(s)}`
            const res = await fetch(url, { cache: 'no-store' })
            if (!res.ok) return null
            const json = await res.json().catch(() => null)
            const body = json?.body
            if (!body) return null
            const bid = Number(body.Bid ?? body.bid)
            const ask = Number(body.Ask ?? body.ask)
            const spread = Number(body.Spread ?? body.spread)
            const ts = Number(body.Timestamp ?? body.ts)
            if (!Number.isFinite(bid) || !Number.isFinite(ask)) return null
            const symbol = (body.Symbol || body.symbol || s).toString()
            return { symbol, bid, ask, spread, ts } as Tick
          })
        )
        setTicks((prev) => {
          const next = new Map(prev)
          results.forEach((t) => {
            if (t) next.set(t.symbol, t)
          })
          return next
        })
      } catch {
        // ignore failures
      }
    }

    // Initial tick
    fetchOnce()
    // Start polling
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(fetchOnce, intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [uniqueSymbols, intervalMs])

  return ticks
}

