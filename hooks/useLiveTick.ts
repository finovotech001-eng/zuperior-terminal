"use client"

import { useEffect, useState } from 'react'

interface TickData {
  bid: number
  ask: number
  spread: number
}

export function useLiveTick(symbol: string) {
  const [tick, setTick] = useState<TickData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!symbol) return

    const fetchTick = async () => {
      try {
        setIsLoading(true)
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "https://metaapi.zuperior.com"
        const response = await fetch(`${apiUrl}/api/livedata/tick/${symbol}`)
        if (response.ok) {
          const data = await response.json()
          setTick(data)
        }
      } catch (error) {
        console.error('Tick fetch error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTick()
    const interval = setInterval(fetchTick, 1000) // Poll every second

    return () => clearInterval(interval)
  }, [symbol])

  return { tick, isLoading }
}