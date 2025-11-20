"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
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

const normalizeSymbolForMatch = (value?: string) => {
  if (!value) return ''
  return value.replace(/[^A-Za-z0-9]/g, '').replace(/m$/i, '').toUpperCase()
}

export function ChartContainer({ symbol = "BTCUSD", interval = '1', className, accountId = null, positions = [], onOpenOrderPanel, onClosePosition }: ChartContainerProps) {
  
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  const bidLineRef = useRef<any>(null)
  const askLineRef = useRef<any>(null)
  const [priceLinesDisabled, setPriceLinesDisabled] = useState(false)
  const [settings] = useAtom(settingsAtom)
  
  // Track if chart is ready
  const chartReadyRef = useRef(false)
  const waitingForReadyRef = useRef(false)
  const positionLinesRef = useRef<Map<string, any>>(new Map())
  const positionsRef = useRef<Position[]>(positions)
  useEffect(() => {
    positionsRef.current = positions
  }, [positions])
  
  // Helper function to create position lines - uses positions from props.
  // This version uses the Drawings API (createShape) only, so it works with the plain Charting Library.
  const createPositionLines = useCallback((chart: any, positionsForLines: Position[], chartSymbol: string) => {
    if (!chart || typeof chart.createShape !== 'function') {
      console.warn('[Chart] createPositionLines: chart or createShape unavailable')
      return
    }

    const currentSymbol = normalizeSymbolForMatch(chartSymbol)
    const formatPositionPnl = (pos: Position) => {
      const raw = typeof pos.pnl === 'number'
        ? pos.pnl
        : (pos.currentPrice - pos.openPrice) * (pos.volume ?? 1)
      const formatted = formatCurrency(Math.abs(raw ?? 0), 2)
      const sign = raw >= 0 ? '+' : '-'
      return `${sign}${formatted} USD`
    }

    // Filter positions matching current symbol
    let relevantPositions = positionsForLines.filter(p => {
      if (!p.symbol) return false
      const posSymbol = normalizeSymbolForMatch(p.symbol)
      return posSymbol === currentSymbol
    })

    // Fallback: if nothing matched, allow all positions
    if (!relevantPositions.length) {
      relevantPositions = positionsForLines
    }

    // Clear previous shapes we created
    try {
      if (typeof chart.removeAllShapes === 'function') {
        chart.removeAllShapes()
      }
    } catch {}
    positionLinesRef.current.clear()

    if (!relevantPositions.length) return

    relevantPositions.forEach(pos => {
      const price =
        (Number.isFinite(pos.openPrice) && pos.openPrice > 0 ? pos.openPrice :
        (Number.isFinite(pos.currentPrice) && pos.currentPrice > 0 ? pos.currentPrice : null))

      if (price == null) return

      const qtyText = (pos.volume ?? 0).toFixed(2)
      const pnlText = formatPositionPnl(pos)
      const positionType = pos.type || 'Buy'
      const lineText = `${positionType} ${qtyText} ${pnlText}`

      try {
        void chart.createShape(
          { price },
          {
            shape: 'horizontal_line',
            text: lineText,
          }
        )
      } catch (err) {
        console.error('[Chart] Error creating position shape:', err)
      }
    })
  }, [])
  
  // Clear lines when symbol changes (before creating new ones)
  const prevSymbolRef = useRef<string>(symbol)
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      console.log('[Chart] 🔄 Symbol changed from', prevSymbolRef.current, 'to', symbol, '- clearing old lines')
      // Clear all position lines when symbol changes
      positionLinesRef.current.forEach((line, key) => {
        try {
          if (line && typeof line.remove === 'function') {
            line.remove()
          }
        } catch (e) {
          console.warn('[Chart] Error removing line on symbol change:', e)
        }
      })
      positionLinesRef.current.clear()
      prevSymbolRef.current = symbol
    }
  }, [symbol])
  
  // Refs for chart overlays
  const tpSlLinesRef = useRef<Map<string, { tp?: any; sl?: any }>>(new Map())
  const priceAlertLinesRef = useRef<Map<string, any>>(new Map())
  const signalMarkersRef = useRef<Map<string, any>>(new Map())
  const hmrZonesRef = useRef<Map<string, any>>(new Map())
  const economicCalendarMarkersRef = useRef<Map<string, any>>(new Map())

  // Normalize symbols for display/matching - preserves trailing micro suffix 'm' in lowercase
  // Safe: Pure function, no browser globals
  const normalizeSymbol = (s: string) => {
    if (typeof s !== 'string') return 'BTCUSD'
    const raw = (s || '').replace(/[^A-Za-z0-9]/g, '')
    const hasMicro = /m$/i.test(raw)
    const core = hasMicro ? raw.slice(0, -1) : raw
    return core.toUpperCase() + (hasMicro ? 'm' : '')
  }

  // Normalize symbol for chart loading - removes micro suffix to match datafeed
  // This ensures XAUUSDM loads as XAUUSD chart (they're the same instrument)
  const normalizeSymbolForChart = (s: string) => {
    if (typeof s !== 'string') return 'BTCUSD'
    const raw = (s || '').replace(/[^A-Za-z0-9]/g, '')
    // Remove trailing 'm' if present (e.g., XAUUSDM -> XAUUSD, BTCUSDm -> BTCUSD)
    const withoutMicro = raw.replace(/m$/i, '')
    return withoutMicro.toUpperCase()
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
        // Check if script already loaded
        const existing = document.querySelector(`script[src="${src}"]`)
        if (existing) {
          // Check if script is already loaded by checking if it's in window
          if (src.includes('charting_library.standalone.js') && window.TradingView) {
            resolve()
            return
          }
          if (src.includes('custom-datafeed.js') && window.CustomDatafeed) {
            resolve()
            return
          }
          // Script tag exists but not loaded yet - wait for it
          if (existing.getAttribute('data-loaded') === 'true') {
            resolve()
            return
          }
          // Wait for existing script to load
          existing.addEventListener('load', () => {
            existing.setAttribute('data-loaded', 'true')
            resolve()
          })
          existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
          return
        }
        
        // Try to load from cache first (if supported)
        const cachedScript = sessionStorage.getItem(`script_cache_${src}`)
        if (cachedScript) {
          try {
            // Inject cached script directly
            const script = document.createElement('script')
            script.textContent = cachedScript
            script.setAttribute('data-src', src)
            script.setAttribute('data-loaded', 'true')
            document.head.appendChild(script)
            resolve()
            return
          } catch (e) {
            console.warn('[Chart] Failed to load cached script, fetching fresh:', e)
          }
        }
        
        const script = document.createElement('script')
        script.src = src
        script.setAttribute('data-src', src)
        script.crossOrigin = 'anonymous'
        
        // Cache script content for future loads
        script.onload = () => {
          script.setAttribute('data-loaded', 'true')
          // Cache script content if possible (for small scripts)
          if (src.includes('custom-datafeed.js')) {
            try {
              fetch(src, { cache: 'force-cache' }).then(res => {
                if (res.ok) {
                  res.text().then(text => {
                    if (text.length < 500000) { // Only cache scripts < 500KB
                      sessionStorage.setItem(`script_cache_${src}`, text)
                    }
                  }).catch(() => {})
                }
              }).catch(() => {})
            } catch {}
          }
          resolve()
        }
        
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
        
        // OPTIMIZED: Check if scripts are already loaded (from previous chart instance)
        const tradingViewReady = typeof window.TradingView !== 'undefined'
        const datafeedReady = typeof window.CustomDatafeed !== 'undefined'
        
        if (tradingViewReady && datafeedReady) {
          console.log('[Chart] Scripts already loaded, skipping script loading')
        } else {
          // OPTIMIZED: Load scripts in parallel with aggressive caching
          const scriptsToLoad = [
            '/charting_library/charting_library.standalone.js',
            '/datafeeds/custom-datafeed.js'
          ]
          
          console.log('[Chart] Loading scripts:', scriptsToLoad)
          const startTime = performance.now()
          
          // Prefetch scripts aggressively for faster loading
          scriptsToLoad.forEach(src => {
            if (!document.querySelector(`link[href="${src}"]`)) {
              const link = document.createElement('link')
              link.rel = 'prefetch'
              link.as = 'script'
              link.href = src
              link.crossOrigin = 'anonymous'
              document.head.appendChild(link)
            }
          })
          
          await Promise.all(scriptsToLoad.map(loadScript))
          
          const loadTime = performance.now() - startTime
          console.log('[Chart] Scripts loaded in', loadTime.toFixed(0), 'ms')
        }

        // Wait for TradingView to be fully available (reduced wait time)
        if (!window.TradingView) {
          let retries = 3
          while (!window.TradingView && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 50))
            retries--
          }
        }

        if (!window.TradingView) {
          throw new Error('TradingView not loaded - please refresh the page')
        }
        
        console.log('[Chart] TradingView ready, initializing chart...')
        chartReadyRef.current = false
        waitingForReadyRef.current = false
        positionLinesRef.current.forEach((line) => {
          try {
            if (line && typeof line.remove === 'function') {
              line.remove()
            }
          } catch {}
        })
        positionLinesRef.current.clear()

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

        // Use chart-normalized symbol (removes 'm' suffix) for widget initialization
        // This ensures XAUUSDM loads as XAUUSD chart since they're the same instrument
        const chartSymbol = normalizeSymbolForChart(symbol)
        const displaySymbol = normalizeSymbol(symbol)
        console.log('[Chart] Creating widget - original:', symbol, 'chart symbol:', chartSymbol, 'display:', displaySymbol, 'interval:', interval)
        const widgetStartTime = performance.now()
        const widget = new window.TradingView.widget({
          symbol: chartSymbol,
          interval: interval,
          container: containerRef.current,
          datafeed: datafeed,
          library_path: '/charting_library/',
          locale: 'en',
          debug: false, // Disabled for performance
          disabled_features: [
            'use_localstorage_for_settings',
            'save_chart_properties_to_local_storage',
            'study_templates', // Disable to prevent 404 errors with undefined client/user
            'header_symbol_search', // Disable for faster load
            'header_compare', // Disable for faster load
            'header_screenshot', // Disable if not needed
            'header_chart_type', // Can disable if not needed
            'display_market_status', // Disable for faster load
          ],
          enabled_features: [
            'side_toolbar_in_fullscreen_mode',
          ],
          theme: 'dark',
          fullscreen: false,
          autosize: true,
          // Disable study templates loading to avoid 404 errors
          custom_css_url: undefined,
          saveload_adapter: null,
          loading_screen: { backgroundColor: '#01040D', foregroundColor: '#01040D' }, // Faster perceived load
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
        const widgetTime = performance.now() - widgetStartTime
        console.log('[Chart] Widget created successfully in', widgetTime.toFixed(0), 'ms')
        
        // Clear error on successful creation
        setError(null)
        
        // Preload datafeed to warm cache
        if (typeof datafeed.onReady === 'function') {
          try {
            datafeed.onReady(() => {
              console.log('[Chart] Datafeed ready, chart fully initialized')
            })
          } catch {}
        }
        
        // Register onChartReady callback IMMEDIATELY after widget creation
        widget.onChartReady(() => {
          waitingForReadyRef.current = false
          chartReadyRef.current = true
          
          setTimeout(() => {
            try {
              const chart = widget.activeChart?.()
              if (chart) {
                createPositionLines(chart, positionsRef.current, symbol)
              }
            } catch (err) {
              console.error('[Chart] Error creating position lines on chart ready:', err)
            }
          }, 300)
        })

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
      // Use chart-normalized symbol (removes 'm' suffix) for chart updates
      const newChartSymbol = normalizeSymbolForChart(symbol)
      const displaySymbol = normalizeSymbol(symbol)
      console.log('[Chart] Updating symbol - original:', symbol, 'chart symbol:', newChartSymbol, 'display:', displaySymbol)
      w.onChartReady(() => {
        const chart = w.activeChart()
        if (!chart) return
        const current = (typeof chart.symbol === 'function' ? chart.symbol() : '') || ''
        const currentInterval = (typeof chart.resolution === 'function' ? chart.resolution() : '') || ''
        if (current !== newChartSymbol) {
          chart.setSymbol(newChartSymbol, currentInterval, () => {
            console.log('[Chart] setSymbol (preserve interval) ->', newChartSymbol, currentInterval)
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
        // Use chart-normalized symbol (without 'm') as primary, then try with 'm' suffix
        const chartSym = normalizeSymbolForChart(symbol)
        const displaySym = normalizeSymbol(symbol)
        // Try chart symbol first (without 'm'), then display symbol (with 'm' if applicable)
        const candidates: string[] = [chartSym]
        if (chartSym !== displaySym) {
          candidates.push(displaySym)
        }

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

            const canOrderLine = typeof chart.createOrderLine === 'function'
            const canShapeLine = typeof chart.createShape === 'function'
            if (!canOrderLine && !canShapeLine) {
              // Neither trading lines nor horizontal shapes are available
              setPriceLinesDisabled(true)
              return
            }

            // Helper to create a Bid/Ask line (order line if available, otherwise a horizontal drawing)
            const createPriceLine = async (price: number, isBid: boolean) => {
              if (canOrderLine && typeof chart.createOrderLine === 'function') {
                try {
                  const orderLine = await chart.createOrderLine()
                  if (orderLine) return orderLine
                } catch (e) {
                  console.warn('[Chart] createOrderLine failed for price line, falling back to shape:', e)
                }
              }

              if (canShapeLine && typeof chart.createShape === 'function' && typeof chart.getShapeById === 'function') {
                try {
                  const id = await chart.createShape(
                    { price },
                    {
                      shape: 'horizontal_line',
                      text: isBid ? 'Bid' : 'Ask',
                    }
                  )
                  if (!id) return null
                  const shapeLine = chart.getShapeById(id)
                  return shapeLine || null
                } catch (e) {
                  console.warn('[Chart] createShape/getShapeById failed for price line:', e)
                  return null
                }
              }
              return null
            }

            const updateOrderLine = (ref: any, price: number, isBid: boolean) => {
              // Update existing
              if (ref && typeof ref.setPrice === 'function') {
                try { ref.setPrice(price); return ref } catch {}
              }
              // Create new asynchronously and then configure/update it
              void createPriceLine(price, isBid)
                .then(ol => {
                  if (!ol) return null
                  try {
                    if (typeof ol.setPrice === 'function') ol.setPrice(price)
                    if (typeof ol.setText === 'function') ol.setText(isBid ? 'Bid' : 'Ask')
                    if (typeof ol.setLineColor === 'function') ol.setLineColor(isBid ? '#60A5FA' : '#F59E0B')
                    if (typeof ol.setBodyBackgroundColor === 'function') ol.setBodyBackgroundColor('rgba(0,0,0,0)')
                    if (typeof ol.setQuantity === 'function') ol.setQuantity('')
                  } catch {}
                  return ol
                })
                .catch(err => {
                  console.error('[Chart] Error creating price line:', err)
                  return null
                })
              return null
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
    if (typeof window === 'undefined') return
    const widget = widgetRef.current
    if (!widget) return

    console.log('[Chart] Overlay effect: symbol & positions', {
      symbol,
      positionsCount: positions?.length ?? 0,
      sample: positions?.slice(0, 3).map(p => ({
        id: p.id,
        symbol: p.symbol,
        openPrice: p.openPrice,
        currentPrice: p.currentPrice,
        type: p.type,
      })),
      showOnChart: settings.showOnChart,
    })

    if (!settings.showOnChart) {
      priceAlertLinesRef.current.clear()
      signalMarkersRef.current.clear()
      hmrZonesRef.current.clear()
      economicCalendarMarkersRef.current.clear()
    }

    const applyPositionLines = () => {
      try {
        const chart = widget.activeChart?.()
        if (chart) {
          console.log('[Chart] applyPositionLines: calling createPositionLines', {
            symbol,
            positionsCount: positions?.length ?? 0,
          })
          createPositionLines(chart, positions, symbol)
        }
      } catch (error) {
        console.error('[Chart] Error creating lines on chart ready:', error)
      }
    }

    if (chartReadyRef.current) {
      applyPositionLines()
      return
    }

    if (waitingForReadyRef.current) return
    waitingForReadyRef.current = true

    widget.onChartReady(() => {
      waitingForReadyRef.current = false
      chartReadyRef.current = true
      applyPositionLines()
    })
  }, [symbol, positions, settings.showOnChart, createPositionLines])

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
