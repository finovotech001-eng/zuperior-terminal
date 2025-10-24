/**
 * React Hooks for WebSocket Real-Time Market Data
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import wsManager, { TickData, CandleData, TradeEvent } from '@/lib/websocket-service'

/**
 * Hook to connect to WebSocket hubs on mount
 */
export function useWebSocketConnection(token?: string) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasInitialized = useRef(false)
  const isCleaningUp = useRef(false)

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (hasInitialized.current) return
    hasInitialized.current = true
    isCleaningUp.current = false

    const connect = async () => {
      if (isConnecting || isCleaningUp.current) return
      
      setIsConnecting(true)
      setError(null)

      try {
        // Set token if provided
        if (token) {
          wsManager.setToken(token)
        }

        // Try to connect to all hubs (they handle their own errors)
        await Promise.allSettled([
          wsManager.connectLiveData(),
          wsManager.connectChart(),
          wsManager.connectTrading(),
        ])

        // Only update state if not cleaning up
        if (!isCleaningUp.current) {
          // Check connection state
          const state = wsManager.getConnectionState()
          const hasAnyConnection = 
            state.liveData === 'Connected' ||
            state.chart === 'Connected' ||
            state.trading === 'Connected'

          if (hasAnyConnection) {
            setIsConnected(true)
            console.log('✅ WebSocket connection established')
          } else {
            console.warn('⚠️ WebSocket server unavailable - using fallback data')
            setError('Server offline - using mock data')
          }
        }
      } catch (err) {
        if (!isCleaningUp.current) {
          const errorMessage = err instanceof Error ? err.message : 'Connection failed'
          setError(errorMessage)
          console.warn('⚠️ WebSocket initialization error:', err)
        }
      } finally {
        if (!isCleaningUp.current) {
          setIsConnecting(false)
        }
      }
    }

    // Delay connection slightly to avoid race conditions
    const timeoutId = setTimeout(() => {
      if (!isCleaningUp.current) {
        connect()
      }
    }, 100)

    // Cleanup on unmount
    return () => {
      isCleaningUp.current = true
      clearTimeout(timeoutId)
      
      // Give a small delay before disconnecting to avoid race conditions
      setTimeout(() => {
        if (hasInitialized.current) {
          wsManager.disconnectAll()
          hasInitialized.current = false
        }
      }, 500)
    }
  }, [token, isConnecting])

  const getConnectionState = useCallback(() => {
    return wsManager.getConnectionState()
  }, [])

  return {
    isConnected,
    isConnecting,
    error,
    getConnectionState,
  }
}

/**
 * Hook to subscribe to real-time tick prices for a symbol
 */
export function useTickPrice(symbol: string | undefined) {
  const [tickData, setTickData] = useState<TickData | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (!symbol) return

    const handleTick = (tick: TickData) => {
      setTickData(tick)
    }

    // Subscribe
    wsManager.subscribeToTicks(symbol, handleTick).then(() => {
      setIsSubscribed(true)
    })

    // Cleanup: Unsubscribe
    return () => {
      wsManager.unsubscribeFromTicks(symbol, handleTick)
      setIsSubscribed(false)
    }
  }, [symbol])

  return {
    bid: tickData?.bid,
    ask: tickData?.ask,
    spread: tickData?.spread,
    timestamp: tickData?.timestamp,
    change: tickData?.change,
    changePercent: tickData?.changePercent,
    tickData,
    isSubscribed,
  }
}

/**
 * Hook to subscribe to real-time candles for a symbol and timeframe
 */
export function useCandleData(symbol: string | undefined, timeframe: string = '1m') {
  const [candleData, setCandleData] = useState<CandleData | null>(null)
  const [candles, setCandles] = useState<CandleData['candle'][]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (!symbol) return

    const handleCandle = (candle: CandleData) => {
      setCandleData(candle)
      
      // Add to candles array
      setCandles(prev => {
        const newCandles = [...prev]
        
        // Check if candle already exists (update) or new (append)
        const existingIndex = newCandles.findIndex(
          c => c.time === candle.candle.time
        )
        
        if (existingIndex >= 0) {
          newCandles[existingIndex] = candle.candle
        } else {
          newCandles.push(candle.candle)
        }
        
        // Keep only last 1000 candles
        if (newCandles.length > 1000) {
          newCandles.shift()
        }
        
        return newCandles
      })
    }

    // Subscribe
    wsManager.subscribeToCandles(symbol, timeframe, handleCandle).then(() => {
      setIsSubscribed(true)
    })

    // Cleanup: Unsubscribe
    return () => {
      setIsSubscribed(false)
      // Note: We don't have unsubscribeFromCandles yet, but we should add it
    }
  }, [symbol, timeframe])

  return {
    latestCandle: candleData?.candle,
    candles,
    isSubscribed,
  }
}

/**
 * Hook to subscribe to trade events
 */
export function useTradeEvents() {
  const [trades, setTrades] = useState<TradeEvent[]>([])
  const [latestTrade, setLatestTrade] = useState<TradeEvent | null>(null)

  useEffect(() => {
    const handleTrade = (trade: TradeEvent) => {
      setLatestTrade(trade)
      setTrades(prev => [trade, ...prev].slice(0, 100)) // Keep last 100 trades
    }

    wsManager.subscribeToTrades(handleTrade)

    return () => {
      wsManager.unsubscribeFromTrades(handleTrade)
    }
  }, [])

  return {
    trades,
    latestTrade,
  }
}

/**
 * Hook to subscribe to multiple symbols at once
 */
export function useMultipleTickPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Map<string, TickData>>(new Map())

  useEffect(() => {
    const callbacks = new Map<string, (tick: TickData) => void>()

    // Subscribe to all symbols
    symbols.forEach(symbol => {
      const callback = (tick: TickData) => {
        setPrices(prev => new Map(prev).set(symbol, tick))
      }
      
      callbacks.set(symbol, callback)
      wsManager.subscribeToTicks(symbol, callback)
    })

    // Cleanup
    return () => {
      callbacks.forEach((callback, symbol) => {
        wsManager.unsubscribeFromTicks(symbol, callback)
      })
    }
  }, [symbols.join(',')])

  return prices
}

/**
 * Hook to get WebSocket connection status
 */
export function useWebSocketStatus() {
  const [status, setStatus] = useState({
    liveData: 'Disconnected',
    chart: 'Disconnected',
    trading: 'Disconnected',
  })

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(wsManager.getConnectionState())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return status
}
