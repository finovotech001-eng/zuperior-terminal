"use client"

import { useEffect, useRef, useState } from 'react'
import { useAtom } from 'jotai'
import { cn, formatCurrency } from '@/lib/utils'
import { settingsAtom } from '@/lib/store'
import type { Position } from '@/components/trading/positions-table'

interface ChartContainerProps {
  symbol?: string
  interval?: string // TradingView interval: '1','5','15','60','240','D','W','M'
  className?: string
  accountId?: string | null
  positions?: Position[] // Open positions for chart overlays
  onOpenOrderPanel?: () => void // Callback to open order panel
  onClosePosition?: (positionId: string) => Promise<void> // Callback to close position
}

// TypeScript declarations only - no runtime code, safe for SSR
// These are just type hints for the window object
declare global {
  interface Window {
    TradingView?: any
    tvWidget?: any
    CustomDatafeed?: any
    SignalRDatafeed?: any
  }
}

export function ChartContainer({ symbol = "BTCUSD", interval = '1', className, accountId = null, positions = [], onOpenOrderPanel, onClosePosition }: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  const bidLineRef = useRef<any>(null)
  const askLineRef = useRef<any>(null)
  const [priceLinesDisabled, setPriceLinesDisabled] = useState(false)
  const [settings] = useAtom(settingsAtom)
  
  // Refs for chart overlays
  const positionLinesRef = useRef<Map<string, any>>(new Map())
  const tpSlLinesRef = useRef<Map<string, { tp?: any; sl?: any }>>(new Map())
  const priceAlertLinesRef = useRef<Map<string, any>>(new Map())
  const signalMarkersRef = useRef<Map<string, any>>(new Map())
  const hmrZonesRef = useRef<Map<string, any>>(new Map())
  const economicCalendarMarkersRef = useRef<Map<string, any>>(new Map())

  // Normalize symbols while preserving trailing micro suffix 'm' in lowercase
  // Safe: Pure function, no browser globals
  const normalizeSymbol = (s: string) => {
    if (typeof s !== 'string') return 'BTCUSD'
    const raw = (s || '').replace(/[^A-Za-z0-9]/g, '')
    const hasMicro = /m$/i.test(raw)
    const core = hasMicro ? raw.slice(0, -1) : raw
    return core.toUpperCase() + (hasMicro ? 'm' : '')
  }

  useEffect(() => {
    // CRITICAL: Early return if not in browser - prevents 'self is not defined' errors
    if (typeof window === 'undefined' || !containerRef.current) return

    const loadScript = (src: string): Promise<void> => {
      // Guard: Only run in browser
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return Promise.reject(new Error('Cannot load script: not in browser'))
      }
      
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
        // Guard: Only load in browser (not during SSR)
        if (typeof window === 'undefined') {
          console.warn('[Chart] Skipping chart initialization - not in browser')
          return
        }
        
        // Clear any previous errors
        setError(null)
        
        // OPTIMIZED: Load scripts in parallel for faster initialization
        const scriptsToLoad = [
          '/charting_library/charting_library.standalone.js',
          '/datafeeds/custom-datafeed.js'
        ]
        
        // Only load SignalR if needed (disabled for now)
        // await loadScript('https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/7.0.5/signalr.min.js')
        // await loadScript('/datafeeds/signalr-datafeed.js')
        
        await Promise.all(scriptsToLoad.map(loadScript))

        // Wait a bit for TradingView to be fully available after script loads
        let retries = 10
        while (!window.TradingView && retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
          retries--
        }

        if (!window.TradingView) {
          throw new Error('TradingView not loaded - please refresh the page')
        }

        // Use local proxy routes to avoid CORS issues
        // Proxy routes will forward to https://metaapi.zuperior.com/api with correct case
        console.log('[Chart] Initializing datafeed with baseUrl: /apis')
        const httpFallback = new window.CustomDatafeed({
          baseUrl: '/apis',
          accountId: accountId || undefined,
        })
        
        // Use HTTP-only datafeed for now (SignalR has CORS issues with external API)
        // TODO: Enable SignalR once proxy is fully configured
        let datafeed: any
        const extBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://metaapi.zuperior.com').replace(/\/$/, '')
        
        // Disable SignalR for now due to CORS issues - use HTTP polling instead
        const useSignalR = false; // Set to true once SignalR proxy is working
        
        if (useSignalR && window.SignalRDatafeed && typeof window.SignalRDatafeed === 'function') {
          console.log('[Chart] Using SignalR datafeed with fallback')
          datafeed = new window.SignalRDatafeed(extBase, httpFallback, { accountId: accountId || undefined })
        } else {
          console.log('[Chart] Using HTTP datafeed only (SignalR disabled)')
          datafeed = httpFallback
        }

        const normalizedSymbol = normalizeSymbol(symbol)
        console.log('[Chart] Creating widget with symbol:', normalizedSymbol, 'interval:', interval)
        const widget = new window.TradingView.widget({
          symbol: normalizedSymbol,
          interval: interval,
          container: containerRef.current,
          datafeed: datafeed,
          library_path: '/charting_library/',
          locale: 'en',
          debug: false, // Disabled for performance
          disabled_features: [
            'use_localstorage_for_settings',
            'save_chart_properties_to_local_storage',
            'study_templates',
          ],
          theme: 'dark',
          fullscreen: false,
          autosize: true,
          // Disable study templates loading to avoid 404 errors
          custom_css_url: undefined,
          saveload_adapter: null,
          overrides: {
            "paneProperties.background": "#01040D",
            "paneProperties.vertGridProperties.color": "#2a2e39",
            "paneProperties.horzGridProperties.color": "#2a2e39",
            "scalesProperties.textColor": "#787b86",
            "scalesProperties.lineColor": "#2a2e39",
            // Explicitly set chart type to candlesticks (style 1 = candles, 0 = line, 2 = area)
            "mainSeriesProperties.style": 1,
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
        console.log('[Chart] Widget created successfully')
        
        // Clear error on successful creation
        setError(null)

        // Hook into toolbar to intercept + button click
        if (onOpenOrderPanel && widget.onChartReady) {
          widget.onChartReady(() => {
            try {
              // Wait a bit for toolbar to be ready
              setTimeout(() => {
                const container = containerRef.current
                if (!container) return

                // Find the + button in TradingView toolbar (it has a specific class/selector)
                // TradingView toolbar buttons are in the header widget area
                const toolbar = container.querySelector('[data-name="header-toolbar"]') || 
                               container.querySelector('.chart-widget-header') ||
                               container.querySelector('[class*="toolbar"]')
                
                if (toolbar) {
                  const attachHandler = (btn: Element) => {
                    const htmlBtn = btn as HTMLElement
                    if (htmlBtn.dataset?.customHandler) return

                    // Check if this is the + button (usually contains a plus icon or specific aria-label)
                    const hasPlusIcon = btn.querySelector('svg')?.innerHTML?.includes('M12 5v14M5 12h14') || // Plus path
                                       btn.querySelector('svg')?.innerHTML?.includes('plus') ||
                                       btn.getAttribute('aria-label')?.toLowerCase().includes('add') ||
                                       btn.getAttribute('aria-label')?.toLowerCase().includes('new') ||
                                       btn.getAttribute('title')?.toLowerCase().includes('add') ||
                                       btn.getAttribute('title')?.toLowerCase().includes('new')
                    
                    // Also check for + text content
                    const textContent = btn.textContent?.trim()
                    const isPlusButton = textContent === '+' || textContent === 'Add' || hasPlusIcon
                    
                    if (isPlusButton) {
                      htmlBtn.dataset.customHandler = 'true'
                      
                      // Add click handler
                      btn.addEventListener('click', (e) => {
                        // Prevent default TradingView behavior for + button
                        e.stopPropagation()
                        e.preventDefault()
                        
                        // Open order panel instead
                        console.log('[Chart] + button clicked, opening order panel')
                        onOpenOrderPanel()
                      }, true) // Use capture phase to intercept early
                    }
                  }

                  // Find all buttons with + icon or "add" functionality
                  const buttons = toolbar.querySelectorAll('button, div[role="button"]')
                  buttons.forEach(attachHandler)

                  // Also listen for any click events on toolbar that might be the + button
                  const observer = new MutationObserver(() => {
                    const buttons = toolbar.querySelectorAll('button, div[role="button"]')
                    buttons.forEach(attachHandler)
                  })

                  observer.observe(toolbar, { childList: true, subtree: true })
                  
                  // Store observer to cleanup later
                  const htmlContainer = container as HTMLElement
                  if (htmlContainer && !htmlContainer.dataset.observerAttached) {
                    htmlContainer.dataset.observerAttached = 'true'
                  }
                }
              }, 1000) // Wait 1 second for toolbar to fully render
            } catch (err) {
              console.warn('[Chart] Failed to hook toolbar button:', err)
            }
          })
        }

      } catch (err) {
        console.error('[Chart] Error:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load chart'
        setError(errorMessage)
        
        // Auto-retry once after 2 seconds if it's a loading error
        if (errorMessage.includes('not loaded') || errorMessage.includes('Failed to load')) {
          setTimeout(() => {
            console.log('[Chart] Retrying initialization...')
            initChart()
          }, 2000)
        }
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
  }, [accountId, interval, symbol])

  // Update symbol dynamically without resetting user's chart resolution
  useEffect(() => {
    // Guard: Only run in browser
    if (typeof window === 'undefined') return
    
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
  }, [symbol])

  // Poll live tick and move bid/ask lines
  useEffect(() => {
    // Guard: Only run in browser
    if (typeof window === 'undefined') return
    
    let timer: NodeJS.Timeout | null = null
    const run = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://metaapi.zuperior.com'
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

  // Update chart overlays based on settings and positions
  useEffect(() => {
    // Guard: Only run in browser
    if (typeof window === 'undefined') return
    
    const w = widgetRef.current
    if (!w || !settings.showOnChart) {
      // Clear all overlays if showOnChart is disabled
      positionLinesRef.current.clear()
      tpSlLinesRef.current.clear()
      priceAlertLinesRef.current.clear()
      signalMarkersRef.current.clear()
      hmrZonesRef.current.clear()
      economicCalendarMarkersRef.current.clear()
      return
    }

    w.onChartReady(() => {
      try {
        const chart = w.activeChart?.()
        if (!chart) return

        const normalizeSymbolForMatch = (s: string) => {
          return s.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
        }
        const currentSymbol = normalizeSymbolForMatch(symbol)

        const formatPositionPnl = (pos: Position) => {
          const raw = typeof pos.pnl === 'number'
            ? pos.pnl
            : (pos.currentPrice - pos.openPrice) * (pos.volume ?? 1)
          const formatted = formatCurrency(Math.abs(raw ?? 0), 2)
          const sign = raw >= 0 ? '+' : '-'
          return `${sign}${formatted} USD`
        }
        
        // Helper to extract position ID for closing
        const extractPositionId = (pos: Position): number | null => {
          if (pos.ticket && pos.ticket > 0) {
            return pos.ticket
          } else if (pos.position) {
            const match = pos.position.match(/\d+/)
            if (match) {
              return parseInt(match[0], 10)
            }
          } else if (pos.id && pos.id.startsWith('ticket-')) {
            const match = pos.id.match(/ticket-(\d+)/)
            if (match) {
              return parseInt(match[1], 10)
            }
          }
          return null
        }
        
        // Filter positions for current symbol
        const relevantPositions = positions.filter(p => {
          const posSymbol = normalizeSymbolForMatch(p.symbol)
          return posSymbol === currentSymbol || posSymbol.replace('M', '') === currentSymbol.replace('M', '')
        })

        // Show/Hide Open Positions
        if (settings.showOpenPositions) {
          // Process positions sequentially to avoid race conditions
          const processPositions = async () => {
            for (const pos of relevantPositions) {
            const key = `pos_${pos.id}`
            const qtyText = (pos.volume ?? 0).toFixed(2)
            const pnlText = formatPositionPnl(pos)
            // Format: volume +P/L USD X
            const lineText = `${qtyText} ${pnlText} X`
              
            if (!positionLinesRef.current.has(key)) {
              try {
                  // Try createPositionLine first (preferred for positions)
                  let line: any = null
                  if (typeof chart.createPositionLine === 'function') {
                    try {
                      line = await chart.createPositionLine()
                      if (line && typeof line.setPrice === 'function') {
                        line.setPrice(pos.openPrice)
                        if (typeof line.setText === 'function') line.setText(lineText)
                        if (typeof line.setQuantity === 'function') line.setQuantity(qtyText)
                        // Blue color for entry lines
                        if (typeof line.setLineColor === 'function') line.setLineColor('#4A9EFF')
                        if (typeof line.setBodyBackgroundColor === 'function') line.setBodyBackgroundColor('rgba(0,0,0,0)')
                        if (typeof line.setQuantityBackgroundColor === 'function') line.setQuantityBackgroundColor('#4A9EFF')
                        if (typeof line.setQuantityTextColor === 'function') line.setQuantityTextColor('#FFFFFF')
                        // Set line style to solid and thin if available
                        if (typeof line.setLineStyle === 'function') {
                          try { line.setLineStyle(0) } catch {} // 0 = solid
                        }
                        if (typeof line.setLineWidth === 'function') {
                          try { line.setLineWidth(1) } catch {} // 1 = thin
                        }
                        // Add click handler for close
                        // TradingView lines may not support onClick directly, but we try it first
                        if (onClosePosition) {
                          if (typeof line.onClick === 'function') {
                            try {
                              line.onClick(() => {
                                const positionId = extractPositionId(pos)
                                if (positionId) {
                                  onClosePosition(pos.id).catch(e => {
                                    console.error('[Chart] Failed to close position:', e)
                                  })
                                }
                              })
                            } catch {}
                          }
                          // Also try setCancellable/setEditable if available
                          if (typeof line.setCancellable === 'function') {
                            try { line.setCancellable(true) } catch {}
                          }
                        }
                        positionLinesRef.current.set(key, line)
                        console.log('[Chart] ✅ Created position line for:', pos.symbol, 'at price:', pos.openPrice)
                      }
                    } catch (e) {
                      console.warn('[Chart] createPositionLine failed, trying createOrderLine:', e)
                    }
                  }
                  
                  // Fallback to createOrderLine if createPositionLine is not available
                  if (!line && typeof chart.createOrderLine === 'function') {
                    line = chart.createOrderLine()
                  if (line && typeof line.setPrice === 'function') {
                    line.setPrice(pos.openPrice)
                      if (typeof line.setText === 'function') line.setText(lineText)
                    if (typeof line.setQuantity === 'function') line.setQuantity(qtyText)
                      // Blue color for entry lines
                      if (typeof line.setLineColor === 'function') line.setLineColor('#4A9EFF')
                    if (typeof line.setBodyBackgroundColor === 'function') line.setBodyBackgroundColor('rgba(0,0,0,0)')
                      if (typeof line.setQuantityBackgroundColor === 'function') line.setQuantityBackgroundColor('#4A9EFF')
                    if (typeof line.setQuantityTextColor === 'function') line.setQuantityTextColor('#FFFFFF')
                      // Set line style to solid and thin if available
                      if (typeof line.setLineStyle === 'function') {
                        try { line.setLineStyle(0) } catch {} // 0 = solid
                      }
                      if (typeof line.setLineWidth === 'function') {
                        try { line.setLineWidth(1) } catch {} // 1 = thin
                      }
                      // Add click handler for close
                      if (onClosePosition) {
                        if (typeof line.onClick === 'function') {
                          try {
                            line.onClick(() => {
                              const positionId = extractPositionId(pos)
                              if (positionId) {
                                onClosePosition(pos.id).catch(e => {
                                  console.error('[Chart] Failed to close position:', e)
                                })
                              }
                            })
                          } catch {}
                        }
                        if (typeof line.setCancellable === 'function') {
                          try { line.setCancellable(true) } catch {}
                        }
                      }
                    positionLinesRef.current.set(key, line)
                      console.log('[Chart] ✅ Created order line (fallback) for:', pos.symbol, 'at price:', pos.openPrice)
                    }
                  }
                  
                  if (!line) {
                    console.warn('[Chart] ⚠️ No line creation method available for position:', pos.id)
                }
              } catch (e) {
                  console.error('[Chart] ❌ Failed to create position line:', e, 'for position:', pos)
              }
            } else {
              // Update existing line
              const line = positionLinesRef.current.get(key)
              if (line) {
                try {
                  if (typeof line.setPrice === 'function') line.setPrice(pos.openPrice)
                    if (typeof line.setText === 'function') line.setText(lineText)
                  if (typeof line.setQuantity === 'function') line.setQuantity(qtyText)
                  // Update color to blue
                  if (typeof line.setLineColor === 'function') line.setLineColor('#4A9EFF')
                  if (typeof line.setQuantityBackgroundColor === 'function') line.setQuantityBackgroundColor('#4A9EFF')
                  } catch (e) {
                    console.warn('[Chart] Failed to update position line:', e)
                  }
                }
              }
            }
          }
          
          processPositions().catch(e => {
            console.error('[Chart] Error processing positions:', e)
          })
          
          // Remove lines for positions that no longer exist
          positionLinesRef.current.forEach((line, key) => {
            if (!relevantPositions.some(p => `pos_${p.id}` === key)) {
              try {
                if (line && typeof line.remove === 'function') {
                  line.remove()
                }
              } catch {}
              positionLinesRef.current.delete(key)
            }
          })
        } else {
          // Remove all position lines
          positionLinesRef.current.forEach((line) => {
            try {
              if (line && typeof line.remove === 'function') {
                line.remove()
              }
            } catch {}
          })
          positionLinesRef.current.clear()
        }

        // Show/Hide TP/SL Lines
        if (settings.showTPSL) {
          relevantPositions.forEach(pos => {
            const key = `tpsl_${pos.id}`
            const tpslRefs = tpSlLinesRef.current.get(key) || {}
            
            // Take Profit line
            if (pos.takeProfit && pos.takeProfit > 0) {
              const qtyText = (pos.volume ?? 0).toFixed(2)
              const pnlText = formatPositionPnl(pos)
              // Format: TP volume +P/L USD X
              const tpText = `TP ${qtyText} ${pnlText} X`
              
              if (!tpslRefs.tp) {
                try {
                  if (typeof chart.createOrderLine === 'function') {
                    const tpLine = chart.createOrderLine()
                    if (tpLine && typeof tpLine.setPrice === 'function') {
                      tpLine.setPrice(pos.takeProfit)
                      tpLine.setText(tpText)
                      // Green color for TP lines
                      tpLine.setLineColor('#10B981')
                      tpLine.setBodyBackgroundColor('rgba(0,0,0,0)')
                      // Set line style to solid and thin if available
                      if (typeof tpLine.setLineStyle === 'function') {
                        try { tpLine.setLineStyle(0) } catch {} // 0 = solid
                      }
                      if (typeof tpLine.setLineWidth === 'function') {
                        try { tpLine.setLineWidth(1) } catch {} // 1 = thin
                      }
                      // Add click handler for close
                      if (onClosePosition) {
                        if (typeof tpLine.onClick === 'function') {
                          try {
                            tpLine.onClick(() => {
                              const positionId = extractPositionId(pos)
                              if (positionId) {
                                onClosePosition(pos.id).catch(e => {
                                  console.error('[Chart] Failed to close position:', e)
                                })
                              }
                            })
                          } catch {}
                        }
                        if (typeof tpLine.setCancellable === 'function') {
                          try { tpLine.setCancellable(true) } catch {}
                        }
                      }
                      tpslRefs.tp = tpLine
                    }
                  }
                } catch (e) {
                  console.warn('[Chart] Failed to create TP line:', e)
                }
              } else {
                try {
                  if (tpslRefs.tp && typeof tpslRefs.tp.setPrice === 'function') {
                    tpslRefs.tp.setPrice(pos.takeProfit)
                    if (typeof tpslRefs.tp.setText === 'function') {
                      tpslRefs.tp.setText(tpText)
                    }
                  }
                } catch {}
              }
            } else if (tpslRefs.tp) {
              try {
                if (tpslRefs.tp && typeof tpslRefs.tp.remove === 'function') {
                  tpslRefs.tp.remove()
                }
              } catch {}
              tpslRefs.tp = undefined
            }

            // Stop Loss line
            if (pos.stopLoss && pos.stopLoss > 0) {
              const qtyText = (pos.volume ?? 0).toFixed(2)
              // For SL, calculate potential loss: (openPrice - stopLoss) * volume
              const slLoss = pos.type === 'Buy' 
                ? (pos.openPrice - pos.stopLoss) * (pos.volume ?? 1)
                : (pos.stopLoss - pos.openPrice) * (pos.volume ?? 1)
              const slLossFormatted = formatCurrency(Math.abs(slLoss), 2)
              // Format: SL volume -P/L USD X (always negative for SL)
              const slText = `SL ${qtyText} -${slLossFormatted} USD X`
              
              if (!tpslRefs.sl) {
                try {
                  if (typeof chart.createOrderLine === 'function') {
                    const slLine = chart.createOrderLine()
                    if (slLine && typeof slLine.setPrice === 'function') {
                      slLine.setPrice(pos.stopLoss)
                      slLine.setText(slText)
                      // Red color for SL lines
                      slLine.setLineColor('#EF4444')
                      slLine.setBodyBackgroundColor('rgba(0,0,0,0)')
                      // Set line style to solid and thin if available
                      if (typeof slLine.setLineStyle === 'function') {
                        try { slLine.setLineStyle(0) } catch {} // 0 = solid
                      }
                      if (typeof slLine.setLineWidth === 'function') {
                        try { slLine.setLineWidth(1) } catch {} // 1 = thin
                      }
                      // Add click handler for close
                      if (onClosePosition) {
                        if (typeof slLine.onClick === 'function') {
                          try {
                            slLine.onClick(() => {
                              const positionId = extractPositionId(pos)
                              if (positionId) {
                                onClosePosition(pos.id).catch(e => {
                                  console.error('[Chart] Failed to close position:', e)
                                })
                              }
                            })
                          } catch {}
                        }
                        if (typeof slLine.setCancellable === 'function') {
                          try { slLine.setCancellable(true) } catch {}
                        }
                      }
                      tpslRefs.sl = slLine
                    }
                  }
                } catch (e) {
                  console.warn('[Chart] Failed to create SL line:', e)
                }
              } else {
                try {
                  if (tpslRefs.sl && typeof tpslRefs.sl.setPrice === 'function') {
                    tpslRefs.sl.setPrice(pos.stopLoss)
                    if (typeof tpslRefs.sl.setText === 'function') {
                      tpslRefs.sl.setText(slText)
                    }
                  }
                } catch {}
              }
            } else if (tpslRefs.sl) {
              try {
                if (tpslRefs.sl && typeof tpslRefs.sl.remove === 'function') {
                  tpslRefs.sl.remove()
                }
              } catch {}
              tpslRefs.sl = undefined
            }

            tpSlLinesRef.current.set(key, tpslRefs)
          })
          
          // Remove TP/SL lines for positions that no longer exist
          tpSlLinesRef.current.forEach((refs, key) => {
            if (!relevantPositions.some(p => `tpsl_${p.id}` === key)) {
              try {
                if (refs.tp && typeof refs.tp.remove === 'function') refs.tp.remove()
                if (refs.sl && typeof refs.sl.remove === 'function') refs.sl.remove()
              } catch {}
              tpSlLinesRef.current.delete(key)
            }
          })
        } else {
          // Remove all TP/SL lines
          tpSlLinesRef.current.forEach((refs) => {
            try {
              if (refs.tp && typeof refs.tp.remove === 'function') refs.tp.remove()
              if (refs.sl && typeof refs.sl.remove === 'function') refs.sl.remove()
            } catch {}
          })
          tpSlLinesRef.current.clear()
        }

        // Price Alerts - placeholder (would need price alert data)
        if (!settings.showPriceAlerts) {
          priceAlertLinesRef.current.forEach((line) => {
            try {
              if (line && typeof line.remove === 'function') {
                line.remove()
              }
            } catch {}
          })
          priceAlertLinesRef.current.clear()
        }

        // Signals - placeholder (would need signals data)
        if (!settings.showSignals) {
          signalMarkersRef.current.forEach((marker) => {
            try {
              if (marker && typeof marker.remove === 'function') {
                marker.remove()
              }
            } catch {}
          })
          signalMarkersRef.current.clear()
        }

        // HMR Periods - placeholder (would need HMR data)
        if (!settings.showHMR) {
          hmrZonesRef.current.forEach((zone) => {
            try {
              if (zone && typeof zone.remove === 'function') {
                zone.remove()
              }
            } catch {}
          })
          hmrZonesRef.current.clear()
        }

        // Economic Calendar - placeholder (would need calendar data)
        if (!settings.showEconomicCalendar) {
          economicCalendarMarkersRef.current.forEach((marker) => {
            try {
              if (marker && typeof marker.remove === 'function') {
                marker.remove()
              }
            } catch {}
          })
          economicCalendarMarkersRef.current.clear()
        }

      } catch (e) {
        console.warn('[Chart] Error updating overlays:', e)
      }
    })
  }, [symbol, positions, settings])

  // Clear error when widget successfully loads
  useEffect(() => {
    if (widgetRef.current && error) {
      setError(null)
    }
  }, [error])

  // Only show error if widget is not loaded
  if (error && !widgetRef.current) {
    return (
      <div className={cn("w-full h-full bg-[#01040D] rounded-lg flex items-center justify-center", className)}>
        <div className="text-center p-4">
          <p className="text-red-500 mb-2 text-sm font-medium">Chart Error</p>
          <p className="text-white/60 text-xs mb-4">{error}</p>
          <button 
            onClick={() => {
              setError(null)
              window.location.reload()
            }}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/80 text-xs"
          >
            Reload Page
          </button>
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
