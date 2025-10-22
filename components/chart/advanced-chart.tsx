"use client"

import * as React from "react"
import "@klinecharts/pro/dist/klinecharts-pro.css"
import "./chart-pro-overrides.css"
import type { Datafeed, SymbolInfo, Period, DatafeedSubscribeCallback } from "@klinecharts/pro"
import type { KLineData } from "klinecharts"
import { cn } from "@/lib/utils"

interface AdvancedChartProps {
  symbol?: string
  symbolName?: string
  className?: string
}

// Custom datafeed implementation for KLineChart Pro
class CustomDatafeed implements Datafeed {
  private subscribers: Map<string, DatafeedSubscribeCallback> = new Map()

  async searchSymbols(search?: string): Promise<SymbolInfo[]> {
    // Mock symbol search
    const symbols: SymbolInfo[] = [
      { ticker: 'XAUUSD', name: 'Gold vs US Dollar', shortName: 'XAUUSD', exchange: 'FOREX', market: 'forex', priceCurrency: 'USD' },
      { ticker: 'EURUSD', name: 'Euro vs US Dollar', shortName: 'EURUSD', exchange: 'FOREX', market: 'forex', priceCurrency: 'USD' },
      { ticker: 'GBPUSD', name: 'British Pound vs US Dollar', shortName: 'GBPUSD', exchange: 'FOREX', market: 'forex', priceCurrency: 'USD' },
      { ticker: 'BTCUSD', name: 'Bitcoin vs US Dollar', shortName: 'BTCUSD', exchange: 'CRYPTO', market: 'crypto', priceCurrency: 'USD' },
    ]
    
    if (search) {
      return symbols.filter(s => 
        s.ticker.toLowerCase().includes(search.toLowerCase()) ||
        s.name?.toLowerCase().includes(search.toLowerCase())
      )
    }
    
    return symbols
  }

  async getHistoryKLineData(
    symbol: SymbolInfo,
    period: Period,
    from: number,
    to: number
  ): Promise<KLineData[]> {
  // Generate realistic sample data
    const data: KLineData[] = []
    const bars = Math.min(Math.floor((to - from) / this.getPeriodMilliseconds(period)), 1000)
    let price = 2000 + Math.random() * 100
    
    for (let i = 0; i < bars; i++) {
      const timestamp = from + i * this.getPeriodMilliseconds(period)
      const volatility = 15
      const change = (Math.random() - 0.5) * volatility
      
      price = price + change
      const open = price
      const close = price + (Math.random() - 0.5) * volatility
      const high = Math.max(open, close) + Math.random() * volatility * 0.5
      const low = Math.min(open, close) - Math.random() * volatility * 0.5
      const volume = 50000 + Math.random() * 100000
      
      data.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume
      })
      
      price = close
    }
    
    return data
  }

  subscribe(symbol: SymbolInfo, period: Period, callback: DatafeedSubscribeCallback): void {
    const key = `${symbol.ticker}_${period.text}`
    this.subscribers.set(key, callback)
  }

  unsubscribe(symbol: SymbolInfo, period: Period): void {
    const key = `${symbol.ticker}_${period.text}`
    this.subscribers.delete(key)
  }

  private getPeriodMilliseconds(period: Period): number {
    const multiplier = period.multiplier
    switch (period.timespan) {
      case 'minute': return multiplier * 60 * 1000
      case 'hour': return multiplier * 60 * 60 * 1000
      case 'day': return multiplier * 24 * 60 * 60 * 1000
      case 'week': return multiplier * 7 * 24 * 60 * 60 * 1000
      default: return 24 * 60 * 60 * 1000
    }
  }
}

// Zuperior theme styles
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zuperiorStyles: any = {
  grid: {
    show: true,
    horizontal: {
      show: true,
      size: 1,
      color: 'rgba(139, 92, 246, 0.08)',
      style: 'solid',
    },
    vertical: {
      show: true,
      size: 1,
      color: 'rgba(139, 92, 246, 0.08)',
      style: 'solid',
    },
  },
  candle: {
    type: 'candle_solid',
    bar: {
      upColor: '#3B82F6',
      downColor: '#EF4444',
      upBorderColor: '#3B82F6',
      downBorderColor: '#EF4444',
      upWickColor: '#3B82F6',
      downWickColor: '#EF4444',
    },
    tooltip: {
      showRule: 'always',
      showType: 'standard',
      text: {
        size: 12,
        family: 'Manrope, sans-serif',
        weight: 'normal',
        color: '#FAFAFA',
      },
    },
  },
  indicator: {
    tooltip: {
      showRule: 'always',
      showType: 'standard',
      text: {
        size: 12,
        family: 'Manrope, sans-serif',
        weight: 'normal',
        color: '#FAFAFA',
      },
    },
        },
        crosshair: {
    show: true,
    horizontal: {
      show: true,
      line: {
        show: true,
        style: 'dashed',
            width: 1,
        color: '#8B5CF6',
      },
      text: {
        show: true,
        color: '#FFFFFF',
        size: 11,
        family: 'Manrope, sans-serif',
        weight: 'normal',
        backgroundColor: '#8B5CF6',
      },
    },
    vertical: {
      show: true,
      line: {
        show: true,
        style: 'dashed',
            width: 1,
        color: '#8B5CF6',
      },
      text: {
        show: true,
        color: '#FFFFFF',
        size: 11,
        family: 'Manrope, sans-serif',
        weight: 'normal',
        backgroundColor: '#8B5CF6',
      },
    },
  },
  xAxis: {
    show: true,
    axisLine: {
      show: true,
      color: 'rgba(255, 255, 255, 0.08)',
      size: 1,
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: 'rgba(255, 255, 255, 0.08)',
    },
    tickText: {
      show: true,
      color: '#9CA3AF',
      size: 11,
      family: 'Manrope, sans-serif',
      weight: 'normal',
    },
  },
  yAxis: {
    show: true,
    position: 'right',
    type: 'normal',
    inside: false,
    reverse: false,
    axisLine: {
      show: true,
      color: 'rgba(255, 255, 255, 0.08)',
      size: 1,
    },
    tickLine: {
      show: true,
      size: 1,
      length: 3,
      color: 'rgba(255, 255, 255, 0.08)',
    },
    tickText: {
      show: true,
      color: '#9CA3AF',
      size: 11,
      family: 'Manrope, sans-serif',
      weight: 'normal',
    },
  },
}

export function AdvancedChart({ 
  symbol = "XAUUSD", 
  symbolName = "Gold vs US Dollar",
  className 
}: AdvancedChartProps) {
  const chartContainerRef = React.useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartProRef = React.useRef<any>(null) // Use any to access internal _chartApi
  const datafeedRef = React.useRef<CustomDatafeed | null>(null)
  const clickHandlerRef = React.useRef<((e: MouseEvent) => void) | null>(null)
  const [isMounted, setIsMounted] = React.useState(false)
  const [isChartReady, setIsChartReady] = React.useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [KLineChartProClass, setKLineChartProClass] = React.useState<any>(null)

  // Ensure client-side only rendering
  React.useEffect(() => {
    setIsMounted(true)
    
    // Dynamically import KLineChartPro only on client side
    import("@klinecharts/pro").then((module) => {
      setKLineChartProClass(() => module.KLineChartPro)
    }).catch((error) => {
      console.error("Failed to load KLineChartPro:", error)
    })
  }, [])

  React.useEffect(() => {
    if (!chartContainerRef.current || typeof window === 'undefined' || !isMounted || !KLineChartProClass) return
    if (chartProRef.current) return // Already initialized

    const container = chartContainerRef.current // Store for cleanup

    try {
      // Create datafeed instance
      if (!datafeedRef.current) {
        datafeedRef.current = new CustomDatafeed()
      }

      // Initialize KLineChart Pro
      const chartPro = new KLineChartProClass({
        container: container,
        styles: zuperiorStyles,
        theme: 'dark',
        locale: 'en-US',
        drawingBarVisible: true,
        watermark: '', // Remove watermark
        symbol: {
          ticker: symbol,
          name: symbolName,
          shortName: symbol,
          exchange: 'FOREX',
          market: 'forex',
          priceCurrency: 'USD'
        },
        period: { multiplier: 1, timespan: 'day', text: '1D' },
        periods: [
          { multiplier: 1, timespan: 'minute', text: '1m' },
          { multiplier: 5, timespan: 'minute', text: '5m' },
          { multiplier: 15, timespan: 'minute', text: '15m' },
          { multiplier: 30, timespan: 'minute', text: '30m' },
          { multiplier: 1, timespan: 'hour', text: '1H' },
          { multiplier: 4, timespan: 'hour', text: '4H' },
          { multiplier: 1, timespan: 'day', text: '1D' },
          { multiplier: 1, timespan: 'week', text: '1W' },
        ],
        timezone: 'America/New_York',
        mainIndicators: ['MA', 'EMA', 'BOLL'],
        subIndicators: [], // No sub-indicators by default
        datafeed: datafeedRef.current
      })

      chartProRef.current = chartPro
      setIsChartReady(true)

      // Intercept all clicks to fix clear button functionality
      clickHandlerRef.current = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        // Check if it's a delete/clear button
        const button = target.closest('button, [role="button"]')
        if (button) {
          const svg = button.querySelector('svg')
          const title = button.getAttribute('title') || ''
          const ariaLabel = button.getAttribute('aria-label') || ''
          
          // If it's a trash/delete icon or has delete/clear in title
          if (svg?.innerHTML.includes('trash') || 
              title.toLowerCase().includes('delete') ||
              title.toLowerCase().includes('clear') ||
              ariaLabel.toLowerCase().includes('delete') ||
              ariaLabel.toLowerCase().includes('clear')) {
            // Give the button time to work, then ensure all overlays are cleared
            setTimeout(() => {
              if (chartProRef.current?._chartApi) {
                chartProRef.current._chartApi.removeOverlay()
              }
            }, 100)
          }
        }
      }
      
      container.addEventListener('click', clickHandlerRef.current, true)

      console.log('✅ KLineChart Pro initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize KLineChart Pro:', error)
    }

    // Cleanup
    return () => {
      // Remove click listener
      if (container && clickHandlerRef.current) {
        container.removeEventListener('click', clickHandlerRef.current, true)
      }
      
      // KLineChart Pro handles cleanup internally
      setIsChartReady(false)
      chartProRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, KLineChartProClass]) // Intentionally excluding symbol/symbolName - handled by separate effect

  // Handle symbol changes dynamically without recreating the chart
  React.useEffect(() => {
    if (!isChartReady || !chartProRef.current) return
    
    // Update symbol using KLineChart Pro API
    const newSymbol = {
      ticker: symbol,
      name: symbolName,
      shortName: symbol,
      exchange: 'FOREX',
      market: 'forex',
      priceCurrency: 'USD'
    }
    
    chartProRef.current.setSymbol?.(newSymbol)
    console.log('📊 Chart symbol updated to:', symbol)
  }, [symbol, symbolName, isChartReady])

  // Handle responsive resizing - watch container and call chart resize
  React.useEffect(() => {
    // Wait for both container and chart to be ready
    if (!chartContainerRef.current || !isChartReady) {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      if (chartProRef.current?._chartApi) {
        const chartApi = chartProRef.current._chartApi
        
        // Try different resize methods
        if (typeof chartApi.resize === 'function') {
          chartApi.resize()
        } else if (typeof chartApi.adjustSize === 'function') {
          chartApi.adjustSize()
        } else {
          // Dispatch window resize as fallback
          window.dispatchEvent(new Event('resize'))
        }
      }
    })

    resizeObserver.observe(chartContainerRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isChartReady])

  // Don't render until mounted and KLineChartPro is loaded (prevents SSR issues)
  if (!isMounted || !KLineChartProClass) {
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
