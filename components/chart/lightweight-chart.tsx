"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface LightweightChartProps {
  symbol?: string
  className?: string
}

declare global {
  interface Window {
    LightweightCharts: any
  }
}

export function LightweightChart({ 
  symbol = "EURUSD", 
  className 
}: LightweightChartProps) {
  const chartContainerRef = React.useRef<HTMLDivElement>(null)
  const chartRef = React.useRef<any>(null)
  const candleSeriesRef = React.useRef<any>(null)
  const volumeSeriesRef = React.useRef<any>(null)
  const [isLibraryLoaded, setIsLibraryLoaded] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isClient, setIsClient] = React.useState(false)

  // Prevent hydration mismatch
  React.useEffect(() => {
    setIsClient(true)
  }, [])

  // Load Lightweight Charts library
  React.useEffect(() => {
    if (!isClient) return
    
    if (window.LightweightCharts) {
      setIsLibraryLoaded(true)
      return
    }
    
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js'
    script.async = true
    script.onload = () => setIsLibraryLoaded(true)
    document.head.appendChild(script)
  }, [isClient])

  // Fetch chart data from API
  const fetchChartData = React.useCallback(async (symbol: string) => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch data from your API proxy
      const url = `/apis/chart/proxy?symbol=${symbol}&timeframe=15&count=300`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No data received')
      }

      // Transform API data to chart format
      const candleData = data.map((candle: any) => ({
        time: new Date(candle.time).getTime() / 1000, // Convert to seconds
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }))

      const volumeData = data.map((candle: any) => ({
        time: new Date(candle.time).getTime() / 1000,
        value: candle.volume,
        color: candle.close > candle.open ? '#26a69a' : '#ef5350',
      }))

      return { candleData, volumeData }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch chart data'
      console.error('[Chart] Error:', err)
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initialize chart
  React.useEffect(() => {
    if (!chartContainerRef.current || !isLibraryLoaded || chartRef.current || !isClient) return

    try {
      // Create chart
      const chart = window.LightweightCharts.createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        layout: {
          backgroundColor: '#01040D',
          textColor: '#9CA3AF',
        },
        grid: {
          vertLines: {
            color: 'rgba(139, 92, 246, 0.08)',
          },
          horzLines: {
            color: 'rgba(139, 92, 246, 0.08)',
          },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: true,
        },
      })

      chartRef.current = chart

      // Create candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#3B82F6',
        downColor: '#EF4444',
        borderUpColor: '#3B82F6',
        borderDownColor: '#EF4444',
        wickUpColor: '#3B82F6',
        wickDownColor: '#EF4444',
      })
      candleSeriesRef.current = candleSeries

      candleSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      })

      // Create volume series
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
        color: '#26a69a',
      })
      volumeSeriesRef.current = volumeSeries

      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      })

      // Load initial data
      fetchChartData(symbol).then((data) => {
        if (data) {
          candleSeries.setData(data.candleData)
          volumeSeries.setData(data.volumeData)
        }
      })
    } catch (error) {
      console.error('Failed to initialize chart:', error)
      setError('Failed to initialize chart')
    }
  }, [isLibraryLoaded, fetchChartData, symbol, isClient])

  // Handle symbol changes
  React.useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current || !isClient) return

    fetchChartData(symbol).then((data) => {
      if (data) {
        candleSeriesRef.current.setData(data.candleData)
        volumeSeriesRef.current.setData(data.volumeData)
      }
    })
  }, [symbol, fetchChartData, isClient])

  // Handle window resize
  React.useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current || !isClient) return

    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.resize(
          chartContainerRef.current.clientWidth,
          chartContainerRef.current.clientHeight
        )
      }
    })

    resizeObserver.observe(chartContainerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isClient])

  // Cleanup
  React.useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [])

  if (!isClient) {
    return (
      <div className={cn("w-full h-full bg-[#01040D] rounded-lg overflow-hidden border border-white/8 flex items-center justify-center", className)}>
        <div className="text-white/60 text-sm">Loading...</div>
      </div>
    )
  }

  if (!isLibraryLoaded) {
    return (
      <div className={cn("w-full h-full bg-[#01040D] rounded-lg overflow-hidden border border-white/8 flex items-center justify-center", className)}>
        <div className="text-white/60 text-sm">Loading chart library...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("w-full h-full bg-[#01040D] rounded-lg overflow-hidden border border-white/8 flex items-center justify-center", className)}>
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    )
  }

  return (
    <div 
      ref={chartContainerRef} 
      className={cn("w-full h-full bg-[#01040D] rounded-lg overflow-hidden border border-white/8", className)}
    />
  )
}

