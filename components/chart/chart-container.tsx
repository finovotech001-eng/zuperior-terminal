"use client"

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ChartContainerProps {
  symbol?: string
  interval?: string // TradingView interval: '1','5','15','60','240','D','W','M'
  className?: string
  accountId?: string | null
}

declare global {
  interface Window {
    TradingView: any
    tvWidget: any
    CustomDatafeed: any
    SignalRDatafeed: any
  }
}

export function ChartContainer({ symbol = "BTCUSD", interval = '1', className, accountId = null }: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  const bidLineRef = useRef<any>(null)
  const askLineRef = useRef<any>(null)
  const [priceLinesDisabled, setPriceLinesDisabled] = useState(false)

  // Normalize symbols while preserving trailing micro suffix 'm' in lowercase
  // Examples:
  //  - "XAU/USD" -> "XAUUSD"
  //  - "xauusdm" -> "XAUUSDm"
  //  - "XAUUSDM" -> "XAUUSDm"
  //  - "BTCUSD"  -> "BTCUSD"
  const normalizeSymbol = (s: string) => {
    const raw = (s || '').replace(/[^A-Za-z0-9]/g, '')
    const hasMicro = /m$/i.test(raw)
    const core = hasMicro ? raw.slice(0, -1) : raw
    return core.toUpperCase() + (hasMicro ? 'm' : '')
  }

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

        // Point datafeed directly at your backend (not the local proxy), with configurable templates
        const extBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://18.175.242.21:5003').replace(/\/$/, '')
        const historyTemplate = process.env.NEXT_PUBLIC_CHART_HISTORY_TEMPLATE || '/chart/candle/history/{symbol}?timeframe={timeframe}&count={count}'
        const currentTemplate = process.env.NEXT_PUBLIC_CHART_CURRENT_TEMPLATE || '/chart/candle/current/{symbol}?timeframe={timeframe}'
        const httpFallback = new window.CustomDatafeed({
          baseUrl: `${extBase}/api`,
          historyTemplate,
          currentTemplate,
          trySymbolVariant: true,
          accountId: accountId || undefined,
        })
        // Prefer SignalR datafeed if available, otherwise fall back to HTTP
        let datafeed: any
        if (window.SignalRDatafeed && typeof window.SignalRDatafeed === 'function') {
          datafeed = new window.SignalRDatafeed(extBase, httpFallback, { accountId: accountId || undefined })
        } else {
          console.warn('[Chart] window.SignalRDatafeed missing, falling back to HTTP datafeed')
          datafeed = httpFallback
        }

        console.log('[Chart] Creating widget...')
        const widget = new window.TradingView.widget({
          symbol: normalizeSymbol(symbol),
          interval: interval,
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
        // Lines will be created lazily after first successful tick in the updater
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
  }, [])

  // Update symbol dynamically without resetting user's chart resolution
  useEffect(() => {
    const w = widgetRef.current
    if (!w) return
    try {
      const newSymbol = normalizeSymbol(symbol)
      w.onChartReady(() => {
        const chart = w.activeChart()
        if (!chart) return
        const current = (typeof chart.symbol === 'function' ? chart.symbol() : '') || ''
        const currentInterval = (typeof chart.resolution === 'function' ? chart.resolution() : '') || ''
        if (current !== newSymbol) {
          chart.setSymbol(newSymbol, currentInterval, () => {
            console.log('[Chart] setSymbol (preserve interval) ->', newSymbol, currentInterval)
          })
        }
      })
    } catch (e) {
      console.warn('[Chart] setSymbol failed', e)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol])

  // Poll live tick and move bid/ask lines
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null
    const run = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://18.175.242.21:5003'
        const sym = normalizeSymbol(symbol)
        // Try primary symbol, then fallback by toggling micro suffix
        const candidates: string[] = [sym]
        if (/m$/.test(sym)) candidates.push(sym.replace(/m$/, ''))
        else candidates.push(sym + 'm')

        let d: any = null
        for (const candidate of candidates) {
          const resp = await fetch(`${base}/api/livedata/tick/${candidate}`, { cache: 'no-store' })
          if (resp.ok) {
            d = await resp.json().catch(() => null)
            if (d) break
          } else if (resp.status !== 404) {
            // Non-404 error: break and do not try further
            break
          }
        }
        if (!d) return
        const bidRaw = (d.bid ?? d.Bid)
        const askRaw = (d.ask ?? d.Ask)
        const bid = Number(bidRaw), ask = Number(askRaw)
        if (!Number.isFinite(bid) || !Number.isFinite(ask)) return
        const w = widgetRef.current
        if (!w || priceLinesDisabled) return
        w.onChartReady(() => {
          try {
            const chart = w.activeChart?.()
            if (!chart) return

            // Only support order lines; never attempt createShape
            if (typeof chart.createOrderLine !== 'function') {
              setPriceLinesDisabled(true)
              return
            }

            const updateOrderLine = (ref: any, price: number, isBid: boolean) => {
              // Update existing
              if (ref && typeof ref.setPrice === 'function') {
                try { ref.setPrice(price); return ref } catch {}
              }
              // Create new
              const ol = chart.createOrderLine()
              try {
                if (typeof ol.setPrice === 'function') ol.setPrice(price)
                if (typeof ol.setText === 'function') ol.setText(isBid ? 'Bid' : 'Ask')
                if (typeof ol.setLineColor === 'function') ol.setLineColor(isBid ? '#60A5FA' : '#F59E0B')
                if (typeof ol.setBodyBackgroundColor === 'function') ol.setBodyBackgroundColor('rgba(0,0,0,0)')
                if (typeof ol.setQuantity === 'function') ol.setQuantity('')
              } catch {}
              return ol
            }

            const newBid = updateOrderLine(bidLineRef.current, bid, true)
            if (newBid) bidLineRef.current = newBid
            const newAsk = updateOrderLine(askLineRef.current, ask, false)
            if (newAsk) askLineRef.current = newAsk
          } catch (e) {
            // Disable on any unexpected library error
            setPriceLinesDisabled(true)
          }
        })
      } catch {}
    }
    run()
    timer = setInterval(run, 1000)
    return () => { if (timer) clearInterval(timer) }
  }, [symbol, priceLinesDisabled])

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
