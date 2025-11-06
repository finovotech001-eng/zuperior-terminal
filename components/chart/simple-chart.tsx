"use client"

import { useEffect, useRef, useState } from 'react'
import * as signalR from '@microsoft/signalr'

interface CandleData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
  tickVolume?: number
}

interface SimpleChartProps {
  symbol?: string
  timeframe?: number
}

export function SimpleChart({ symbol = "BTCUSD", timeframe = 1 }: SimpleChartProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [candles, setCandles] = useState<CandleData[]>([])
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const chartConnectionRef = useRef<signalR.HubConnection | null>(null)
  const liveDataConnectionRef = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    const initConnections = async () => {
      try {
        const chartConnection = new signalR.HubConnectionBuilder()
          .withUrl("/apis/signalr/negotiate", {
            skipNegotiation: true,
            transport: signalR.HttpTransportType.LongPolling
          })
          .build()

        const liveDataConnection = new signalR.HubConnectionBuilder()
          .withUrl("/apis/signalr/negotiate", {
            skipNegotiation: true,
            transport: signalR.HttpTransportType.LongPolling
          })
          .build()

        // Setup event handlers
        chartConnection.on("HistoricalCandles", (data: { candles: CandleData[] }) => {
          console.log("📊 Historical candles:", data.candles)
          setCandles(data.candles)
        })

        chartConnection.on("CandleUpdate", (data: { candle: CandleData }) => {
          console.log("🔴 Live candle update:", data.candle)
          setCandles(prev => {
            const newCandles = [...prev]
            const lastIndex = newCandles.length - 1
            if (lastIndex >= 0) {
              // Update the last candle or add new one
              const lastCandle = newCandles[lastIndex]
              const newTime = new Date(data.candle.time).getTime()
              const lastTime = new Date(lastCandle.time).getTime()
              
              if (newTime > lastTime) {
                newCandles.push(data.candle)
              } else {
                newCandles[lastIndex] = data.candle
              }
            } else {
              newCandles.push(data.candle)
            }
            return newCandles
          })
          setCurrentPrice(data.candle.close)
        })

        liveDataConnection.on("TickUpdate", (data: { bid: number; ask: number; spread: number }) => {
          console.log("💹 Tick update:", data)
          setCurrentPrice((data.bid + data.ask) / 2) // Mid price
        })

        // Start connections
        await Promise.all([
          chartConnection.start(),
          liveDataConnection.start()
        ])

        chartConnectionRef.current = chartConnection
        liveDataConnectionRef.current = liveDataConnection
        setIsConnected(true)

        // Subscribe to symbol
        await chartConnection.invoke("GetHistoricalCandles", symbol, timeframe, 500)
        await chartConnection.invoke("SubscribeToCandles", symbol, timeframe)
        await liveDataConnection.invoke("SubscribeToTicks", symbol)

        console.log(`✅ Subscribed to ${symbol} with timeframe ${timeframe}`)
        
        // Fallback: Poll REST API for tick data
        const pollTick = async () => {
          try {
            const response = await fetch(`${apiUrl}/api/livedata/tick/${symbol}`)
            if (response.ok) {
              const data = await response.json()
              setCurrentPrice((data.bid + data.ask) / 2)
            }
          } catch {}
        }
        setInterval(pollTick, 1000)
        
      } catch (error) {
        console.error("❌ SignalR connection failed:", error)
      }
    }

    initConnections()

    return () => {
      chartConnectionRef.current?.stop()
      liveDataConnectionRef.current?.stop()
    }
  }, [symbol, timeframe])

  return (
    <div className="w-full h-full bg-gray-900 text-white p-4 rounded-lg">
      <div className="mb-4">
        <h2 className="text-xl font-bold">{symbol}</h2>
        <div className="flex gap-4 text-sm">
          <span>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</span>
          <span>Candles: {candles.length}</span>
          {currentPrice && <span>Price: {currentPrice.toFixed(5)}</span>}
        </div>
      </div>
      
      <div className="h-64 bg-gray-800 rounded p-2 overflow-y-auto">
        <div className="text-xs font-mono">
          {candles.slice(-10).map((candle, index) => (
            <div key={index} className="mb-1 flex justify-between">
              <span>{new Date(candle.time).toLocaleTimeString()}</span>
              <span className={candle.close > candle.open ? 'text-green-400' : 'text-red-400'}>
                O:{candle.open} H:{candle.high} L:{candle.low} C:{candle.close}
              </span>
              {candle.volume && <span>V:{candle.volume}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}