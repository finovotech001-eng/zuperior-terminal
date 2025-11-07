// SignalR Datafeed for TradingView Charting Library
// Matches tradingview-chart project's implementation
(function (global) {
  class SignalRDatafeed {
    constructor(baseUrl = 'http://localhost:3000', fallbackDatafeed = null, options = {}) {
      this.baseUrl = baseUrl.replace(/\/$/, '');
      this.hubUrl = `${this.baseUrl}/hubs/chart`;
      this._connection = null;
      this._connected = false;
      this._connectPromise = null;
      this._pendingHistoryResolvers = new Map(); // key: symbol|tf -> {resolve, reject}
      this._subscribers = new Map(); // guid -> {symbol, tf, onTick}
      this._lastBars = new Map();
      this._fallback = fallbackDatafeed || null;
      this._accountId = options?.accountId || null;
      this._bindHandlers();
    }

    _bindHandlers() {
      this._onHistoricalCandles = (msg) => {
        try {
          const payload = Array.isArray(msg) ? { candles: msg } : msg || {};
          const symbol = payload.symbol || payload.Symbol || payload?.candles?.[0]?.symbol || '';
          const tf = payload.timeframe || payload.Timeframe || payload.timeFrame || 1;
          const key = `${symbol}|${tf}`;
          let resolver = this._pendingHistoryResolvers.get(key);
          if (!resolver) {
            const entries = Array.from(this._pendingHistoryResolvers.entries());
            if (entries.length === 1) resolver = entries[0][1];
          }
          if (!resolver) return;
          for (const [k] of this._pendingHistoryResolvers) this._pendingHistoryResolvers.delete(k);

          const candles = Array.isArray(payload.candles) ? payload.candles : (Array.isArray(payload.Candles) ? payload.Candles : []);
          const bars = candles.map(c => ({
            time: new Date(c.time).getTime(),
            open: +c.open,
            high: +c.high,
            low: +c.low,
            close: +c.close,
            volume: +(c.volume ?? c.tickVolume ?? 0),
          })).filter(b => Number.isFinite(b.time) && Number.isFinite(b.close))
            .sort((a, b) => a.time - b.time);

          resolver.resolve(bars);
        } catch (e) {
          console.error('[SignalRDatafeed] historical handler error', e);
        }
      };

      this._onCandleUpdate = (msg) => {
        try {
          const payload = msg.candle || msg.Candle || msg;
          const symbol = msg.symbol || msg.Symbol || payload.symbol || '';
          const tf = msg.timeframe || msg.Timeframe || msg.timeFrame || 1;
          const guidEntries = Array.from(this._subscribers.entries())
            .filter(([, s]) => s.symbol === symbol && String(s.tf) === String(tf));
          if (guidEntries.length === 0) return;

          const bar = {
            time: new Date(payload.time).getTime(),
            open: +payload.open,
            high: +payload.high,
            low: +payload.low,
            close: +payload.close,
            volume: +(payload.volume ?? payload.tickVolume ?? 0),
          };
          for (const [guid, sub] of guidEntries) {
            const prev = this._lastBars.get(guid);
            if (!prev || bar.time > prev.time) {
              this._lastBars.set(guid, bar);
              sub.onTick(bar);
            } else {
              const merged = { ...prev };
              merged.high = Math.max(merged.high, bar.high, bar.close);
              merged.low = Math.min(merged.low, bar.low, bar.close);
              merged.close = bar.close;
              merged.volume = Math.max(merged.volume || 0, bar.volume || 0);
              this._lastBars.set(guid, merged);
              sub.onTick(merged);
            }
          }
        } catch (e) {
          console.error('[SignalRDatafeed] update handler error', e);
        }
      };
    }

    async _ensureConnection() {
      if (this._connected) return;
      if (this._connectPromise) return this._connectPromise;
      if (!global.signalR || !global.signalR.HubConnectionBuilder) {
        throw new Error('SignalR client not loaded. Include @microsoft/signalr script.');
      }
      console.log('[SignalRDatafeed] connecting to', this.hubUrl);
      // Proxy HttpClient to route negotiate through our Next.js API to avoid CORS
      const HttpClient = global.signalR.HttpClient;
      class ProxyHttpClient extends HttpClient {
        async get(url, options) {
          try {
            if (url.includes('/negotiate')) {
              const urlObj = new URL(url);
              const qp = urlObj.searchParams.toString();
              const extra = self._accountId ? `&accountId=${encodeURIComponent(self._accountId)}` : '';
              const proxyUrl = `/apis/signalr/negotiate?hub=chart&${qp}${extra}`;
              const res = await fetch(proxyUrl, { method: 'GET', headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
              const text = await res.text();
              return new global.signalR.HttpResponse(res.status, res.statusText, text);
            }
          } catch (e) {
            console.warn('[SignalRDatafeed] negotiate proxy failed, falling back direct', e);
          }
          const res = await fetch(url, { method: 'GET', headers: options?.headers });
          const text = await res.text();
          return new global.signalR.HttpResponse(res.status, res.statusText, text);
        }
        async post(url, options) {
          try {
            if (url.includes('/negotiate')) {
              const urlObj = new URL(url);
              const qp = urlObj.searchParams.toString();
              const extra = (typeof self._accountId !== 'undefined' && self._accountId !== null)
                ? `&accountId=${encodeURIComponent(self._accountId)}`
                : '';
              const proxyUrl = `/apis/signalr/negotiate?hub=chart&${qp}${extra}`;
              const res = await fetch(proxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }, body: options?.content });
              const text = await res.text();
              return new global.signalR.HttpResponse(res.status, res.statusText, text);
            }
          } catch (e) {
            console.warn('[SignalRDatafeed] negotiate proxy failed (POST), falling back direct', e);
          }
          const res = await fetch(url, { method: 'POST', headers: options?.headers, body: options?.content });
          const text = await res.text();
          return new global.signalR.HttpResponse(res.status, res.statusText, text);
        }
        async send(request) {
          const res = await fetch(request.url, { method: request.method || 'GET', headers: request.headers, body: request.content });
          const text = await res.text();
          return new global.signalR.HttpResponse(res.status, res.statusText, text);
        }
      }
      this._connection = new global.signalR.HubConnectionBuilder()
        .withUrl(this.hubUrl, { httpClient: new ProxyHttpClient() })
        .withAutomaticReconnect()
        .build();

      this._connection.on('HistoricalCandles', this._onHistoricalCandles);
      this._connection.on('CandleUpdate', this._onCandleUpdate);

      this._connectPromise = this._connection.start()
        .then(() => { this._connected = true; console.log('[SignalRDatafeed] connected'); })
        .catch((e) => { console.error('[SignalRDatafeed] connect error', e); this._connectPromise = null; throw e; });
      return this._connectPromise;
    }

    onReady(cb) {
      setTimeout(() => cb({
        supported_resolutions: ['1','3','5','15','30','60','120','240','360','480','D','W','M'],
        supports_marks: false,
        supports_timescale_marks: false,
        supports_time: true,
        supports_search: true,
        supports_group_request: false,
      }), 0);
    }

    searchSymbols(userInput, exchange, symbolType, onResult) {
      const base = [
        { symbol: 'BTCUSD', full_name: 'BTCUSD', description: 'Bitcoin vs US Dollar', exchange: 'MT5', type: 'crypto' },
        { symbol: 'BTCUSDm', full_name: 'BTCUSDm', description: 'BTCUSD (m)', exchange: 'MT5', type: 'crypto' },
        { symbol: 'ETHUSD', full_name: 'ETHUSD', description: 'Ethereum vs US Dollar', exchange: 'MT5', type: 'crypto' },
        { symbol: 'EURUSD', full_name: 'EURUSD', description: 'Euro vs US Dollar', exchange: 'MT5', type: 'forex' },
      ];
      const q = (userInput || '').toLowerCase();
      onResult(base.filter(s => s.symbol.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)));
    }

    resolveSymbol(symbolName, onResolve) {
      let pricescale = /USD|EUR|GBP|JPY/.test(symbolName) ? 10000 : 100;
      const info = {
        ticker: symbolName,
        name: symbolName,
        description: symbolName,
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'MT5',
        minmov: 1,
        pricescale,
        has_intraday: true,
        has_daily: true,
        has_weekly_and_monthly: true,
        supported_resolutions: ['1','3','5','15','30','60','120','240','360','480','D','W','M'],
        volume_precision: 2,
        data_status: 'streaming',
      };
      setTimeout(() => onResolve(info), 0);
    }

    _tf(res) {
      const m = { '1':'1','3':'3','5':'5','15':'15','30':'30','60':'60','120':'120','240':'240','360':'360','480':'480','D':'1440','W':'10080','M':'43200' };
      return m[res] || '1';
    }

    async getBars(symbolInfo, resolution, periodParams, onResult, onError) {
      try {
        await this._ensureConnection();
        const tf = this._tf(resolution);
        const count = 500;

        const key = `${symbolInfo.name}|${tf}`;
        const barsPromise = new Promise((resolve, reject) => {
          this._pendingHistoryResolvers.set(key, { resolve, reject });
          setTimeout(() => {
            if (this._pendingHistoryResolvers.get(key)) {
              this._pendingHistoryResolvers.delete(key);
              reject(new Error('HistoricalCandles timeout'));
            }
          }, 15000);
        });

        await this._connection.invoke('GetHistoricalCandles', symbolInfo.name, parseInt(tf, 10), count);
        const bars = await barsPromise;

        const from = (periodParams.from || 0) * 1000;
        const to = (periodParams.to || 0) * 1000;
        const filtered = bars.filter(b => (!from || b.time >= from) && (!to || b.time <= to));
        onResult(filtered.length ? filtered : bars, { noData: (filtered.length ? filtered : bars).length === 0 });
      } catch (e) {
        console.error('[SignalRDatafeed] getBars error', e);
        if (this._fallback && typeof this._fallback.getBars === 'function') {
          return this._fallback.getBars(symbolInfo, resolution, periodParams, onResult, onError);
        }
        onError(e.message || String(e));
      }
    }

    async subscribeBars(symbolInfo, resolution, onTick, listenerGuid) {
      try {
        await this._ensureConnection();
        const tf = parseInt(this._tf(resolution), 10);
        this._subscribers.set(listenerGuid, { symbol: symbolInfo.name, tf, onTick });
        await this._connection.invoke('SubscribeToCandles', symbolInfo.name, tf);
      } catch (e) {
        console.error('[SignalRDatafeed] subscribeBars error', e);
        if (this._fallback && typeof this._fallback.subscribeBars === 'function') {
          return this._fallback.subscribeBars(symbolInfo, resolution, onTick, listenerGuid);
        }
      }
    }

    async unsubscribeBars(listenerGuid) {
      const sub = this._subscribers.get(listenerGuid);
      this._subscribers.delete(listenerGuid);
      this._lastBars.delete(listenerGuid);
      // Optional: if hub supports it, invoke an Unsubscribe
      // await this._connection.invoke('UnsubscribeFromCandles', sub.symbol, sub.tf)
    }

    getServerTime(cb){ cb(Math.floor(Date.now()/1000)); }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = SignalRDatafeed;
  global.SignalRDatafeed = SignalRDatafeed;
})(typeof window !== 'undefined' ? window : globalThis);
