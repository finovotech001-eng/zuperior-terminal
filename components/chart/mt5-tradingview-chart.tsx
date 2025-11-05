"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { MT5LiveDatafeed } from "@/lib/mt5-live-datafeed"
import { MT5SignalRDatafeed } from "@/lib/mt5-signalr-datafeed"

declare global {
  interface Window {
    TradingView?: any
    tvWidget?: any
  }
}

export interface MT5TradingViewChartProps {
  symbol?: string
  interval?: string
  className?: string
}

export function MT5TradingViewChart({ symbol = "BTCUSD", interval = "1", className }: MT5TradingViewChartProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const widgetRef = React.useRef<any>(null)
  const [libLoaded, setLibLoaded] = React.useState(false)
  const [isClient, setIsClient] = React.useState(false)
  const priceLineTimerRef = React.useRef<number | null>(null)
  const priceLinesBusyRef = React.useRef(false)
  const useOrderLinesRef = React.useRef(true)
  const askLineRef = React.useRef<any>(null)
  const bidLineRef = React.useRef<any>(null)
  const midLineRef = React.useRef<any>(null)
  const askShapeIdRef = React.useRef<string | null>(null)
  const bidShapeIdRef = React.useRef<string | null>(null)
  const midShapeIdRef = React.useRef<string | null>(null)
  const hubRef = React.useRef<any>(null)
  const hubConnectedRef = React.useRef(false)
  const currentSubRef = React.useRef<{ symbol: string; tfMin: number } | null>(null)

  React.useEffect(() => {
    setIsClient(true)
  }, [])

  // Load TradingView library
  React.useEffect(() => {
    if (!isClient) return
    if (window.TradingView) {
      setLibLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = '/charting_library/charting_library.standalone.js'
    script.async = true
    script.onload = () => setLibLoaded(true)
    document.head.appendChild(script)
  }, [isClient])

  const resToMinutes = React.useCallback((res: string): number => {
    if (/^\d+$/.test(res)) return parseInt(res, 10)
    if (res === 'D' || res === '1D') return 1440
    if (res === 'W' || res === '1W') return 10080
    if (res === 'M' || res === '1M') return 43200
    return 1
  }, [])

  const ensureOrderLines = React.useCallback(async (widget: any) => {
    const chart = widget?.activeChart?.()
    if (!chart) return null
    try {
      if (!askLineRef.current) {
        askLineRef.current = await chart.createOrderLine()
        askLineRef.current
          .setLineColor('#f6465d')
          .setLineStyle(2)
          .setLineLength(100, 'percentage')
          .setBodyBackgroundColor('#f6465d')
          .setBodyTextColor('#ffffff')
          .setExtendLeft(false)
      }
      if (!bidLineRef.current) {
        bidLineRef.current = await chart.createOrderLine()
        bidLineRef.current
          .setLineColor('#2962ff')
          .setLineStyle(2)
          .setLineLength(100, 'percentage')
          .setBodyBackgroundColor('#2962ff')
          .setBodyTextColor('#ffffff')
          .setExtendLeft(false)
      }
      if (!midLineRef.current) {
        midLineRef.current = await chart.createOrderLine()
        midLineRef.current
          .setLineColor('#131722')
          .setLineStyle(0)
          .setLineLength(100, 'percentage')
          .setBodyBackgroundColor('#26a69a')
          .setBodyTextColor('#ffffff')
          .setExtendLeft(false)
      }
    } catch (e) {
      useOrderLinesRef.current = false
    }
    return chart
  }, [])

  const refreshPriceLines = React.useCallback(async (widget: any, close: number | null) => {
    if (priceLinesBusyRef.current) return
    priceLinesBusyRef.current = true
    try {
      const chart = await ensureOrderLines(widget)
      if (!chart) return
      const sym = chart.symbol()
      const tf = chart.resolution()
      const tfMin = resToMinutes(tf)

      if (!Number.isFinite(close as number)) return

      const tfSec = tfMin * 60
      const nowSec = Math.floor(Date.now() / 1000)
      const remaining = Math.max(0, tfSec - (nowSec % tfSec))
      const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
      const ss = String(remaining % 60).padStart(2, '0')

      if (useOrderLinesRef.current) {
        if (midLineRef.current) midLineRef.current.setText(sym).setPrice(close).setQuantity(`${(close as number).toFixed(5)}  ${mm}:${ss}`)
      } else {
        if (midShapeIdRef.current) { chart.removeEntity(midShapeIdRef.current, { disableUndo: true }); midShapeIdRef.current = null }
      }
    } catch {
      // ignore
    } finally {
      priceLinesBusyRef.current = false
    }
  }, [ensureOrderLines, resToMinutes])

  // Init widget
  React.useEffect(() => {
    if (!libLoaded || !containerRef.current || widgetRef.current) return
    try {
      // Prefer SignalR datafeed; fall back to REST if connection fails
      const datafeed = new MT5SignalRDatafeed()
      const widget = (window.tvWidget = new window.TradingView.widget({
        debug: true,
        fullscreen: false,
        symbol,
        interval,
        container: containerRef.current,
        datafeed,
        library_path: '/charting_library/',
        locale: 'en',
        disabled_features: ['use_localstorage_for_settings'],
        // Disable study_templates unless charts storage is configured
        enabled_features: [],
        theme: 'dark',
        overrides: {
          'paneProperties.background': '#131722',
          'scalesProperties.textColor': '#787b86',
          'scalesProperties.lineColor': '#2a2e39',
          'mainSeriesProperties.style': 1,
          'volumePaneSize': 'large',
          'tradingProperties.showOrders': true,
          'tradingProperties.showExecutions': true,
        },
        autosize: true,
      }))
      widgetRef.current = widget

      widget.onChartReady(async () => {
        // Setup SignalR for live close price labels
        try {
          if (!hubConnectedRef.current) {
            const signalR = await import('@microsoft/signalr')
            const { HubConnectionBuilder, LogLevel, HttpClient, HttpResponse, HttpRequest } = signalR as any

            // Try to get MT5 accountId from localStorage
            const accountId = typeof window !== 'undefined' ? localStorage.getItem('accountId') : null

            // Obtain MT5 client token via our auth API if possible
            let clientToken: string | null = null
            if (accountId) {
              try {
                const resp = await fetch('/apis/auth/mt5-login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ accountId }),
                })
                if (resp.ok) {
                  const data = await resp.json()
                  clientToken = data?.data?.accessToken || null
                }
              } catch {}
            }

            // Proxy HTTP client to inject headers into negotiate
            class ProxyHttpClient extends (HttpClient as any) {
              get(url: string, options?: typeof HttpRequest): Promise<typeof HttpResponse> {
                if (url.includes('/negotiate')) {
                  const urlObj = new URL(url)
                  const proxyUrl = `/apis/signalr/negotiate?hub=chart&${urlObj.searchParams.toString()}`
                  const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    ...(clientToken ? { 'X-Client-Token': clientToken } : {}),
                    ...(accountId ? { 'X-Account-ID': accountId } : {}),
                    ...(options?.headers || {}),
                  }
                  return fetch(proxyUrl, { method: 'GET', headers }).then(async (response) => {
                    const data = await response.json()
                    return new HttpResponse(response.status, response.statusText, JSON.stringify(data))
                  })
                }
                return fetch(url, {
                  method: options?.method || 'GET',
                  headers: options?.headers,
                  body: options?.content,
                }).then(async (response) => {
                  const content = await response.text()
                  return new HttpResponse(response.status, response.statusText, content)
                })
              }
              post(url: string, options?: typeof HttpRequest): Promise<typeof HttpResponse> {
                return fetch(url, { method: 'POST', headers: options?.headers, body: options?.content }).then(async (response) => {
                  const content = await response.text()
                  return new HttpResponse(response.status, response.statusText, content)
                })
              }
              delete(url: string, options?: typeof HttpRequest): Promise<typeof HttpResponse> {
                return fetch(url, { method: 'DELETE', headers: options?.headers, body: options?.content }).then(async (response) => {
                  const content = await response.text()
                  return new HttpResponse(response.status, response.statusText, content)
                })
              }
            }

            hubRef.current = new HubConnectionBuilder()
              .withUrl(process.env.NEXT_PUBLIC_CHART_HUB_URL || 'http://localhost:5003/hubs/chart', {
                httpClient: new ProxyHttpClient(),
                transport: (signalR as any).HttpTransportType.LongPolling,
                withCredentials: false,
              })
              .withAutomaticReconnect()
              .configureLogging(LogLevel.Error)
              .build()
            await hubRef.current.start()
            hubConnectedRef.current = true
          }

          const bindSub = async () => {
            const sym = widget.activeChart().symbol()
            const tf = widget.activeChart().resolution()
            const tfMin = resToMinutes(tf)
            currentSubRef.current = { symbol: sym, tfMin }
            // Remove existing handler to avoid duplicates
            hubRef.current.off('CandleUpdate')
            hubRef.current.on('CandleUpdate', (payload: any) => {
              if (!payload || !payload.candle) return
              if (!currentSubRef.current) return
              if (payload.symbol && payload.symbol !== currentSubRef.current.symbol) return
              const close = parseFloat(payload.candle?.close)
              refreshPriceLines(widget, Number.isFinite(close) ? close : null)
            })
            await hubRef.current.invoke('SubscribeToCandles', sym, tfMin)
          }

          await bindSub()
          widget.activeChart().onSymbolChanged().subscribe(null, bindSub)
          widget.activeChart().onIntervalChanged().subscribe(null, bindSub)
        } catch (e) {
          // Fallback: do nothing if SignalR not available
        }
      })
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize TradingView widget:', e)
    }

    return () => {
      if (priceLineTimerRef.current) {
        clearInterval(priceLineTimerRef.current)
        priceLineTimerRef.current = null
      }
      if (hubRef.current) {
        try { hubRef.current.stop() } catch {}
        hubRef.current = null
        hubConnectedRef.current = false
      }
      if (widgetRef.current) {
        try { widgetRef.current.remove() } catch {}
        widgetRef.current = null
      }
    }
  }, [libLoaded, symbol, interval, refreshPriceLines])

  if (!isClient) {
    return (
      <div className={cn("w-full h-full bg-[#01040D] rounded-lg overflow-hidden border border-white/8 flex items-center justify-center", className)}>
        <div className="text-white/60 text-sm">Loading...</div>
      </div>
    )
  }
  if (!libLoaded) {
    return (
      <div className={cn("w-full h-full bg-[#01040D] rounded-lg overflow-hidden border border-white/8 flex items-center justify-center", className)}>
        <div className="text-white/60 text-sm">Loading chart library...</div>
      </div>
    )
  }

  return <div ref={containerRef} className={cn("!w-full !h-full bg-[#01040D] rounded-lg overflow-hidden border border-white/8", className)} />
}
