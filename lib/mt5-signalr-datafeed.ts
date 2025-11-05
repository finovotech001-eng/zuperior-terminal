/**
 * MT5 SignalR Datafeed for TradingView Charting Library
 * Uses SignalR hub for historical and live candles.
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
}

interface CandleDTO {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
  tickVolume?: number
  spread?: number
  isComplete?: boolean
}

export class MT5SignalRDatafeed {
  private hubUrl = (process.env.NEXT_PUBLIC_CHART_HUB_URL || 'http://localhost:5003/hubs/chart')
  private connection: any | null = null
  private connected = false
  private subscriptions = new Map<string, { symbol: string; resolution: string }>()
  private lastBars = new Map<string, Bar>()
  private clientToken: string | null = null
  private accountId: string | null = null

  private tfMap(res: string): number {
    if (/^\d+$/.test(res)) return parseInt(res, 10)
    if (res === 'D' || res === '1D') return 1440
    if (res === 'W' || res === '1W') return 10080
    if (res === 'M' || res === '1M') return 43200
    return 1
  }

  private async ensureConnection() {
    if (this.connected && this.connection) return
    const signalR = await import('@microsoft/signalr')
    const { HubConnectionBuilder, LogLevel, HttpClient, HttpResponse, HttpRequest } = signalR as any

    // Try to fetch MT5 client token if missing
    if (typeof window !== 'undefined') {
      this.accountId = this.accountId || localStorage.getItem('accountId')
      if (this.accountId && !this.clientToken) {
        try {
          const resp = await fetch('/apis/auth/mt5-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: this.accountId }),
          })
          if (resp.ok) {
            const data = await resp.json()
            this.clientToken = data?.data?.accessToken || null
          }
        } catch {}
      }
    }

    // Inject headers via proxy client during negotiate
    class ProxyHttpClient extends (HttpClient as any) {
      get(url: string, options?: typeof HttpRequest): Promise<typeof HttpResponse> {
        if (url.includes('/negotiate')) {
          const urlObj = new URL(url)
          const proxyUrl = `/apis/signalr/negotiate?hub=chart&${urlObj.searchParams.toString()}`
          const hdrs: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(thisOuter.clientToken ? { 'X-Client-Token': thisOuter.clientToken } : {}),
            ...(thisOuter.accountId ? { 'X-Account-ID': thisOuter.accountId } : {}),
            ...(options?.headers || {}),
          }
          return fetch(proxyUrl, { method: 'GET', headers: hdrs }).then(async (response) => {
            const data = await response.json()
            return new HttpResponse(response.status, response.statusText, JSON.stringify(data))
          })
        }
        return fetch(url, { method: options?.method || 'GET', headers: options?.headers, body: options?.content }).then(async (response) => {
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
      constructor(private thisOuter: MT5SignalRDatafeed) { super() }
    }

    this.connection = new HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        httpClient: new (ProxyHttpClient as any)(this),
        transport: (signalR as any).HttpTransportType.LongPolling,
        withCredentials: false,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Error)
      .build()
    await this.connection.start()
    this.connected = true
  }

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

  resolveSymbol(symbolName: string, onResolve: (info: SymbolInfo) => void) {
    let pricescale = /USD|EUR|GBP|JPY/.test(symbolName) ? 10000 : 100
    const info: SymbolInfo = {
      ticker: symbolName,
      name: symbolName,
      description: symbolName,
      type: 'forex',
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

  async getBars(
    symbolInfo: SymbolInfo,
    resolution: string,
    periodParams: { from: number; to: number; firstDataRequest: boolean },
    onResult: BarsCallback,
    onError: ErrorCallback,
  ) {
    try {
      await this.ensureConnection()
      const timeframe = this.tfMap(resolution)

      // One-shot listener for historical response
      const handle = (payload: any) => {
        try {
          const candles: CandleDTO[] = Array.isArray(payload?.candles) ? payload.candles : []
          if (!candles.length) {
            onResult([], { noData: true })
            this.connection.off('HistoricalCandles', handle)
            return
          }
          const tfMs = timeframe * 60 * 1000
          const bars: Bar[] = candles
            .map((c) => ({
              time: Math.floor(new Date(c.time).getTime() / tfMs) * tfMs,
              open: +c.open,
              high: +c.high,
              low: +c.low,
              close: +c.close,
              volume: +(c.volume || c.tickVolume || 0),
            }))
            .filter((b) => Number.isFinite(b.time) && Number.isFinite(b.close))
            .sort((a, b) => a.time - b.time)

          onResult(bars, { noData: false })
        } catch (e: any) {
          onError(e?.message || 'HistoricalCandles parse error')
        } finally {
          this.connection.off('HistoricalCandles', handle)
        }
      }
      this.connection.on('HistoricalCandles', handle)
      await this.connection.invoke('GetHistoricalCandles', symbolInfo.name, timeframe, 500)
    } catch (e: any) {
      onError(e?.message || 'getBars error')
    }
  }

  async subscribeBars(
    symbolInfo: SymbolInfo,
    resolution: string,
    onTick: (bar: Bar) => void,
    listenerGuid: string,
    _onResetCacheNeededCallback?: () => void,
  ) {
    await this.ensureConnection()
    const timeframe = this.tfMap(resolution)
    const key = listenerGuid

    const handler = (payload: any) => {
      if (!payload || !payload.candle) return
      const c: CandleDTO = payload.candle
      const tfMs = timeframe * 60 * 1000
      const t = Math.floor(new Date(c.time).getTime() / tfMs) * tfMs
      const next: Bar = {
        time: t,
        open: Number.isFinite(+c.open) ? +c.open : undefined as any,
        high: Number.isFinite(+c.high) ? +c.high : undefined as any,
        low: Number.isFinite(+c.low) ? +c.low : undefined as any,
        close: +c.close,
        volume: +(c.volume || c.tickVolume || 0),
      }
      const last = this.lastBars.get(key)
      if (!last || next.time > last.time) {
        this.lastBars.set(key, {
          time: next.time,
          open: Number.isFinite(next.open) ? next.open : next.close,
          high: Number.isFinite(next.high) ? next.high : next.close,
          low: Number.isFinite(next.low) ? next.low : next.close,
          close: next.close,
          volume: next.volume,
        })
        onTick(this.lastBars.get(key)!)
      } else if (next.time === last.time) {
        const high = Math.max(...[last.high, (next as any).high, next.close].filter((v) => Number.isFinite(v)))
        const low = Math.min(...[last.low, (next as any).low, next.close].filter((v) => Number.isFinite(v)))
        const merged: Bar = {
          time: last.time,
          open: Number.isFinite(last.open) ? last.open : next.close,
          high,
          low,
          close: next.close,
          volume: Number.isFinite(next.volume) ? Math.max(next.volume!, last.volume || 0) : last.volume || 0,
        }
        this.lastBars.set(key, merged)
        onTick(merged)
      }
    }

    // Unique channel binding per listener GUID
    const channelName = `CandleUpdate` // server emits a general event per your sample
    this.connection.on(channelName, handler)
    this.subscriptions.set(key, { symbol: symbolInfo.name, resolution })
    await this.connection.invoke('SubscribeToCandles', symbolInfo.name, timeframe)
  }

  async unsubscribeBars(listenerGuid: string) {
    if (!this.connection) return
    const sub = this.subscriptions.get(listenerGuid)
    if (sub) {
      try {
        const timeframe = this.tfMap(sub.resolution)
        await this.connection.invoke('UnsubscribeFromCandles', sub.symbol, timeframe)
      } catch {}
    }
    this.connection.off('CandleUpdate')
    this.subscriptions.delete(listenerGuid)
    this.lastBars.delete(listenerGuid)
  }
}
