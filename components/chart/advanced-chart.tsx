"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { MT5Datafeed } from "@/lib/mt5-datafeed"

interface AdvancedChartProps {
  symbol?: string
  symbolName?: string
  className?: string
}

declare global {
  interface Window {
    TradingView?: {
      widget: (options: any) => any
    }
  }
}

export function AdvancedChart({ 
  symbol = "XAUUSD", 
  symbolName = "Gold vs US Dollar",
  className 
}: AdvancedChartProps) {
  const chartContainerRef = React.useRef<HTMLDivElement>(null)
  const widgetRef = React.useRef<any>(null)
  const datafeedRef = React.useRef<MT5Datafeed | null>(null)
  const [isChartReady, setIsChartReady] = React.useState(false)
  const [isLibraryLoaded, setIsLibraryLoaded] = React.useState(false)
  
  // Load TradingView library
  React.useEffect(() => {
    // Check if already loaded
    if (window.TradingView) {
      setIsLibraryLoaded(true)
      return
    }
    
    // Create script element
    const script = document.createElement('script')
    script.src = '/charting_library/charting_library.standalone.js'
    script.async = true
    script.onload = () => setIsLibraryLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Initialize TradingView chart
  React.useEffect(() => {
    if (!chartContainerRef.current || !isLibraryLoaded || widgetRef.current) return

    try {
      // Create datafeed instance
      if (!datafeedRef.current) {
        datafeedRef.current = new MT5Datafeed()
      }

      // Normalize symbol (remove slashes for MT5 API)
      const normalizedSymbol = symbol.replace(/\//g, '')
      
      // Initialize TradingView widget
      const widget = window.TradingView!.widget({
        debug: false,
        fullscreen: false,
        symbol: normalizedSymbol,
        interval: '1',
        container: chartContainerRef.current,
        library_path: '/charting_library/',
        locale: 'en',
        disabled_features: [
          'use_localstorage_for_settings',
          'header_widget',
          'header_saveload',
          'header_screenshot',
          'header_chart_type',
          'header_resolutions',
          'header_symbol_search',
          'header_compare',
          'header_undo_redo',
        ],
        enabled_features: ['study_templates'],
        overrides: {
          'paneProperties.background': '#01040D',
          'paneProperties.backgroundType': 'solid',
          'paneProperties.vertGridProperties.color': 'rgba(139, 92, 246, 0.08)',
          'paneProperties.horzGridProperties.color': 'rgba(139, 92, 246, 0.08)',
          'scalesProperties.textColor': '#9CA3AF',
          'mainSeriesProperties.style': 3, // 3 = Candles
          'mainSeriesProperties.candleStyle.upColor': '#3B82F6',
          'mainSeriesProperties.candleStyle.downColor': '#EF4444',
          'mainSeriesProperties.candleStyle.borderUpColor': '#3B82F6',
          'mainSeriesProperties.candleStyle.borderDownColor': '#EF4444',
          'mainSeriesProperties.candleStyle.wickUpColor': '#3B82F6',
          'mainSeriesProperties.candleStyle.wickDownColor': '#EF4444',
        },
        theme: 'dark',
        charts_storage_url: '',
        charts_storage_api_version: '1.1',
        client_id: 'zuperior-terminal',
        user_id: 'public_user_id',
        autosize: true,
        datafeed: datafeedRef.current,
      })

      widgetRef.current = widget
      setIsChartReady(true)
    } catch (error) {
      console.error('Failed to initialize chart:', error)
    }

    // Cleanup
    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove()
        widgetRef.current = null
        setIsChartReady(false)
      }
    }
  }, [isLibraryLoaded, symbol])

  // Handle symbol changes
  React.useEffect(() => {
    if (!isChartReady || !widgetRef.current) return

    const normalizedSymbol = symbol.replace(/\//g, '')
    widgetRef.current.setSymbol(normalizedSymbol, '1', () => {})
  }, [symbol, isChartReady])

  // Don't render until library is loaded
  if (!isLibraryLoaded) {
    return (
      <div className={cn("w-full h-full bg-[#01040D] rounded-lg overflow-hidden border border-white/8 flex items-center justify-center", className)}>
        <div className="text-white/60 text-sm">Loading chart...</div>
      </div>
    )
  }

  return (
    <div 
      ref={chartContainerRef} 
      className={cn("!w-full !h-full bg-[#01040D] rounded-lg overflow-hidden border border-white/8", className)}
    />
  )
}
