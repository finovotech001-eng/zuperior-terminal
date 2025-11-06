"use client"

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ChartContainerProps {
  symbol?: string
  className?: string
}

declare global {
  interface Window {
    TradingView: any
    tvWidget: any
    CustomDatafeed: any
    SignalRDatafeed: any
  }
}

export function ChartContainer({ symbol = "BTCUSD", className }: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve()
          return
        }
        const script = document.createElement('script')
        script.src = src
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(script)
      })
    }

    const initChart = async () => {
      try {
        console.log('[Chart] Loading scripts...')
        await loadScript('/charting_library/charting_library.standalone.js')
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/7.0.5/signalr.min.js')
        await loadScript('/datafeeds/custom-datafeed.js')
        await loadScript('/datafeeds/signalr-datafeed.js')
        console.log('[Chart] Scripts loaded')

        if (!window.TradingView) {
          throw new Error('TradingView not loaded')
        }

        const datafeed = new window.CustomDatafeed('/apis')

        console.log('[Chart] Creating widget...')
        const widget = new window.TradingView.widget({
          symbol: symbol,
          interval: '1',
          container: containerRef.current,
          datafeed: datafeed,
          library_path: '/charting_library/',
          locale: 'en',
          disabled_features: ['use_localstorage_for_settings'],
          theme: 'dark',
          fullscreen: false,
          autosize: true,
          overrides: {
            "paneProperties.background": "#01040D",
            "paneProperties.vertGridProperties.color": "#2a2e39",
            "paneProperties.horzGridProperties.color": "#2a2e39",
            "scalesProperties.textColor": "#787b86",
            "scalesProperties.lineColor": "#2a2e39",
            "mainSeriesProperties.candleStyle.upColor": "#16A34A",
            "mainSeriesProperties.candleStyle.downColor": "#EF4444",
            "mainSeriesProperties.candleStyle.borderUpColor": "#16A34A",
            "mainSeriesProperties.candleStyle.borderDownColor": "#EF4444",
            "mainSeriesProperties.candleStyle.wickUpColor": "#16A34A",
            "mainSeriesProperties.candleStyle.wickDownColor": "#EF4444",
          }
        })

        widgetRef.current = widget
        console.log('[Chart] Widget created')

      } catch (err) {
        console.error('[Chart] Error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load chart')
      }
    }

    initChart()

    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.remove()
        } catch (e) {
          console.error('[Chart] Cleanup error:', e)
        }
      }
    }
  }, [symbol])

  if (error) {
    return (
      <div className={cn("w-full h-full bg-[#01040D] rounded-lg flex items-center justify-center", className)}>
        <div className="text-center">
          <p className="text-red-500 mb-2">Chart Error</p>
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={cn("w-full h-full bg-[#01040D] rounded-lg overflow-hidden", className)}
    />
  )
}
