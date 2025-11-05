/**
 * MT5 Live Datafeed (TypeScript) for TradingView Charting Library
 * Uses Next.js proxy routes:
 *  - History:   /apis/chart/proxy?symbol={S}&timeframe={TF}&count={N}
 *  - Current:   /apis/chart/current?symbol={S}&timeframe={TF}
 *  - Tick:      /apis/livedata/tick/{S}
 */

type BarsCallback = (bars: Bar[], meta?: { noData?: boolean }) => void
type ErrorCallback = (reason: string) => void

interface Bar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

interface SymbolInfo {
  name: string
  ticker: string
  description: string
  type: string
  session: string
  timezone: string
  exchange: string
  minmov: number
  pricescale: number
  has_intraday: boolean
  has_daily?: boolean
  has_weekly_and_monthly?: boolean
  supported_resolutions: string[]
  volume_precision: number
  data_status: string
  full_name?: string
}

export class MT5LiveDatafeed {
  private historyUrl = '/apis/chart/proxy'
  private currentUrl = '/apis/chart/current'
  private tickBase = '/apis/livedata/tick'

  private subscribers: Record<string, number> = {}
  private lastBars: Record<string, Bar | undefined> = {}
  private aggregators: Record<string, any> = {}

  onReady(cb: (conf: any) => void) {
    setTimeout(
      () =>
        cb({
          supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', 'D', 'W', 'M'],
          supports_marks: false,
          supports_timescale_marks: false,
          supports_time: true,
          supports_search: true,
          supports_group_request: false,
        }),
      0,
    )
  }

  searchSymbols(userInput: string, _exchange: string, _symbolType: string, onResult: (symbols: any[]) => void) {
    const symbols = [
      { symbol: 'BTCUSD', full_name: 'BTCUSD', description: 'Bitcoin vs US Dollar', exchange: 'MT5', type: 'crypto' },
      { symbol: 'ETHUSD', full_name: 'ETHUSD', description: 'Ethereum vs US Dollar', exchange: 'MT5', type: 'crypto' },
      { symbol: 'XAUUSD', full_name: 'XAUUSD', description: 'Gold vs US Dollar', exchange: 'MT5', type: 'commodity' },
      { symbol: 'EURUSD', full_name: 'EURUSD', description: 'Euro vs US Dollar', exchange: 'MT5', type: 'forex' },
      { symbol: 'GBPUSD', full_name: 'GBPUSD', description: 'British Pound vs US Dollar', exchange: 'MT5', type: 'forex' },
      { symbol: 'USDJPY', full_name: 'USDJPY', description: 'US Dollar vs Japanese Yen', exchange: 'MT5', type: 'forex' },
    ]
    const q = (userInput || '').toLowerCase()
    onResult(symbols.filter((s) => s.symbol.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)))
  }

  resolveSymbol(symbolName: string, onResolve: (info: SymbolInfo) => void, _onError?: ErrorCallback) {
    let symbolType = 'crypto'
    let pricescale = 100
    if (/USD|EUR|GBP|JPY/.test(symbolName)) pricescale = 10000

    const info: SymbolInfo = {
      ticker: symbolName,
      name: symbolName,
      description: symbolName,
      type: symbolType,
      session: '24x7',
      timezone: 'Etc/UTC',
      exchange: 'MT5',
      minmov: 1,
      pricescale,
      has_intraday: true,
      has_daily: true,
      has_weekly_and_monthly: true,
      supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', 'D', 'W', 'M'],
      volume_precision: 2,
      data_status: 'streaming',
    }
    setTimeout(() => onResolve(info), 0)
  }

  private tfMap(res: string): string {
    const m: Record<string, string> = {
      '1': '1',
      '3': '3',
      '5': '5',
      '15': '15',
      '30': '30',
      '60': '60',
      '120': '120',
      '240': '240',
      '360': '360',
      '480': '480',
      D: '1440',
      W: '10080',
      M: '43200',
      '1D': '1440',
      '1W': '10080',
      '1M': '43200',
    }
    return m[res] || '1'
  }

  async getBars(
    symbolInfo: SymbolInfo,
    resolution: string,
    periodParams: { from: number; to: number; firstDataRequest: boolean },
    onResult: BarsCallback,
    onError: ErrorCallback,
  ) {
    const { from, to, firstDataRequest } = periodParams
    const timeframe = this.tfMap(resolution)
    const count = firstDataRequest ? 100 : 500
    try {
      const url = `${this.historyUrl}?symbol=${encodeURIComponent(symbolInfo.name)}&timeframe=${encodeURIComponent(timeframe)}&count=${count}`
      const resp = await fetch(url, { cache: 'no-cache' })
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`)
      const data = await resp.json()
      if (!Array.isArray(data) || data.length === 0) return onResult([], { noData: true })
      const tfMs = parseInt(timeframe) * 60 * 1000
      let bars: Bar[] = data
        .map((c: any) => ({
          time: Math.floor(new Date(c.time).getTime() / tfMs) * tfMs,
          open: +c.open,
          high: +c.high,
          low: +c.low,
          close: +c.close,
          volume: +(c.volume || 0),
        }))
        .filter((b: any) => Number.isFinite(b.time) && Number.isFinite(b.close))
        .sort((a: any, b: any) => a.time - b.time)

      let finalBars: Bar[]
      if (firstDataRequest) {
        finalBars = bars.slice(-Math.min(100, bars.length))
      } else {
        const filtered = bars.filter((b: any) => b.time >= from * 1000 && b.time <= to * 1000)
        finalBars = filtered.length ? filtered : bars.slice(-Math.min(100, bars.length))
      }

      const tfInt = parseInt(timeframe)
      const newest = finalBars[finalBars.length - 1]?.time || 0
      const needAgg = Number.isFinite(tfInt) && tfInt > 1 && Date.now() - newest > tfInt * 60 * 1000 * 2
      if (needAgg) {
        const need1m = Math.min(tfInt * 105, 6000)
        const oneUrl = `${this.historyUrl}?symbol=${encodeURIComponent(symbolInfo.name)}&timeframe=1&count=${need1m}`
        const oneRes = await fetch(oneUrl, { cache: 'no-cache' })
        if (oneRes.ok) {
          const one = await oneRes.json()
          const oneBars: Bar[] = one
            .map((c: any) => ({
              time: Math.floor(new Date(c.time).getTime() / (60 * 1000)) * 60 * 1000,
              open: +c.open,
              high: +c.high,
              low: +c.low,
              close: +c.close,
              volume: +(c.volume || 0),
            }))
            .filter((b: any) => Number.isFinite(b.time) && Number.isFinite(b.close))
            .sort((a: any, b: any) => a.time - b.time)

          const bucketMs = tfInt * 60 * 1000
          const agg = new Map<number, Bar & { volume: number }>()
          for (const b of oneBars) {
            const bucket = Math.floor(b.time / bucketMs) * bucketMs
            const prev = agg.get(bucket)
            if (!prev) {
              agg.set(bucket, { ...b })
            } else {
              prev.high = Math.max(prev.high, b.high)
              prev.low = Math.min(prev.low, b.low)
              prev.close = b.close
              prev.volume = (prev.volume || 0) + (b.volume || 0)
            }
          }
          const aggregated = Array.from(agg.values()).sort((a, b) => a.time - b.time)
          finalBars = aggregated.slice(-Math.min(100, aggregated.length))
        }
      }

      if (!finalBars.length) return onResult([], { noData: true })
      onResult(finalBars, { noData: false })
    } catch (e: any) {
      onError(e?.message || 'getBars error')
    }
  }

  subscribeBars(
    symbolInfo: SymbolInfo,
    resolution: string,
    onTick: (bar: Bar) => void,
    listenerGuid: string,
    onResetCacheNeededCallback?: () => void,
  ) {
    const timeframe = this.tfMap(resolution)
    const tfInt = parseInt(timeframe)

    if (tfInt === 1) {
      const fetchCurrent = async () => {
        try {
          const url = `${this.currentUrl}?symbol=${encodeURIComponent(symbolInfo.name)}&timeframe=${timeframe}`
          const resp = await fetch(url, { cache: 'no-cache' })
          if (!resp.ok) return
          const candle = await resp.json()
          const timeframeMs = tfInt * 60 * 1000
          let t = Math.floor(new Date(candle.time).getTime() / timeframeMs) * timeframeMs
          const bar: Bar = {
            time: t,
            open: Number.isFinite(+candle.open) ? +candle.open : undefined as any,
            high: Number.isFinite(+candle.high) ? +candle.high : undefined as any,
            low: Number.isFinite(+candle.low) ? +candle.low : undefined as any,
            close: +candle.close,
            volume: +(candle.volume || 0),
          }
          if (!Number.isFinite(bar.time) || !Number.isFinite(bar.close)) return

          const last = this.lastBars[listenerGuid]
          if (!last) {
            const seeded: Bar = {
              time: bar.time,
              open: Number.isFinite(bar.open) ? bar.open : bar.close,
              high: Number.isFinite(bar.high) ? bar.high : bar.close,
              low: Number.isFinite(bar.low) ? bar.low : bar.close,
              close: bar.close,
              volume: bar.volume,
            }
            this.lastBars[listenerGuid] = seeded
            onTick(seeded)
            return
          }

          if (bar.time > last.time) {
            const next: Bar = {
              time: bar.time,
              open: Number.isFinite(bar.open) ? bar.open : bar.close,
              high: Number.isFinite(bar.high) ? bar.high : bar.close,
              low: Number.isFinite(bar.low) ? bar.low : bar.close,
              close: bar.close,
              volume: bar.volume,
            }
            this.lastBars[listenerGuid] = next
            onTick(next)
          } else if (bar.time === last.time) {
            const open = Number.isFinite(last.open) ? (last.open as any) : (Number.isFinite((bar as any).open) ? (bar as any).open : last.close)
            const high = Math.max(...[last.high, (bar as any).high, bar.close].filter((v) => Number.isFinite(v)))
            const low = Math.min(...[last.low, (bar as any).low, bar.close].filter((v) => Number.isFinite(v)))
            const merged: Bar = {
              time: last.time,
              open,
              high,
              low,
              close: bar.close,
              volume: Number.isFinite(bar.volume) ? Math.max(bar.volume!, last.volume || 0) : last.volume || 0,
            }
            const changed = merged.close !== last.close || merged.high !== last.high || merged.low !== last.low || merged.volume !== last.volume
            if (changed) {
              this.lastBars[listenerGuid] = merged
              onTick(merged)
            }
          }
        } catch (e) {
          // ignore
        }
      }
      fetchCurrent()
      const id = window.setInterval(fetchCurrent, 1000)
      this.subscribers[listenerGuid] = id
      return
    }

    // Aggregate realtime for TF > 1 using current 1m
    const bucketMs = tfInt * 60 * 1000
    this.aggregators[listenerGuid] = this.aggregators[listenerGuid] || null
    const fetchAgg = async () => {
      try {
        const oneRes = await fetch(`${this.currentUrl}?symbol=${encodeURIComponent(symbolInfo.name)}&timeframe=1`, { cache: 'no-cache' })
        if (!oneRes.ok) return
        const one = await oneRes.json()
        const oneTime = Math.floor(new Date(one.time).getTime() / (60 * 1000)) * 60 * 1000
        const bucketTime = Math.floor(oneTime / bucketMs) * bucketMs
        const oneBar: Bar = {
          time: oneTime,
          open: Number.isFinite(+one.open) ? +one.open : undefined as any,
          high: Number.isFinite(+one.high) ? +one.high : undefined as any,
          low: Number.isFinite(+one.low) ? +one.low : undefined as any,
          close: +one.close,
          volume: +(one.volume || 0),
        }
        if (!Number.isFinite(oneBar.time) || !Number.isFinite(oneBar.close)) return

        let agg = this.aggregators[listenerGuid]
        if (!agg || bucketTime > agg.time) {
          agg = {
            time: bucketTime,
            open: Number.isFinite(oneBar.open) ? oneBar.open : oneBar.close,
            high: Number.isFinite(oneBar.high) ? oneBar.high : oneBar.close,
            low: Number.isFinite(oneBar.low) ? oneBar.low : oneBar.close,
            close: oneBar.close,
            volume: Number.isFinite(oneBar.volume) ? oneBar.volume : 0,
            _sumPrev: 0,
            _currMinTime: oneBar.time,
            _prevMinVol: Number.isFinite(oneBar.volume) ? oneBar.volume : 0,
          }
          this.aggregators[listenerGuid] = agg
          if (typeof onResetCacheNeededCallback === 'function') {
            try {
              onResetCacheNeededCallback()
            } catch {}
          }
          this.lastBars[listenerGuid] = { ...agg }
          onTick({ ...agg })
          return
        }

        // Extend existing
        agg.high = Math.max(agg.high, Number.isFinite(oneBar.high) ? oneBar.high : oneBar.close, oneBar.close)
        agg.low = Math.min(agg.low, Number.isFinite(oneBar.low) ? oneBar.low : oneBar.close, oneBar.close)
        agg.close = oneBar.close

        if (agg._currMinTime === oneBar.time) {
          agg._prevMinVol = Number.isFinite(oneBar.volume) ? oneBar.volume : agg._prevMinVol
        } else {
          agg._sumPrev += agg._prevMinVol
          agg._currMinTime = oneBar.time
          agg._prevMinVol = Number.isFinite(oneBar.volume) ? oneBar.volume : 0
        }
        agg.volume = agg._sumPrev + agg._prevMinVol
        this.lastBars[listenerGuid] = { ...agg }
        onTick({ ...agg })
      } catch (e) {
        // ignore
      }
    }
    fetchAgg()
    const id = window.setInterval(fetchAgg, 1000)
    this.subscribers[listenerGuid] = id
  }

  unsubscribeBars(listenerGuid: string) {
    if (this.subscribers[listenerGuid]) {
      clearInterval(this.subscribers[listenerGuid])
      delete this.subscribers[listenerGuid]
      delete this.lastBars[listenerGuid]
      if (this.aggregators[listenerGuid]) delete this.aggregators[listenerGuid]
    }
  }

  getServerTime(cb: (ts: number) => void) {
    // Not critical; return client time if backend time not exposed
    cb(Math.floor(Date.now() / 1000))
  }
}

