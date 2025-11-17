// Custom MT5-compatible Datafeed (uses the TradingView Library)
// Simplified implementation following the architecture guide
class CustomDatafeed {
    constructor(baseOrConfig = '/apis') {
        const cfg = (baseOrConfig && typeof baseOrConfig === 'object') ? baseOrConfig : { baseUrl: baseOrConfig };
        this.apiUrl = (cfg.baseUrl || '/apis').replace(/\/$/, '');
        this.accountId = cfg.accountId || null;
        this.subscribers = {};
        this.lastBars = {};
        this.aggregators = {};
        console.log('[CustomDatafeed] Initialized with apiUrl:', this.apiUrl);
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
        const symbols = [
            { symbol: 'BTCUSD', full_name: 'BTCUSD', description: 'Bitcoin vs US Dollar', exchange: '', type: 'crypto' },
            { symbol: 'BTCUSDm', full_name: 'BTCUSDm', description: 'BTCUSD (m)', exchange: '', type: 'crypto' },
            { symbol: 'ETHUSD', full_name: 'ETHUSD', description: 'Ethereum vs US Dollar', exchange: '', type: 'crypto' },
            { symbol: 'XAUUSD', full_name: 'XAUUSD', description: 'Gold vs US Dollar', exchange: '', type: 'commodity' },
            { symbol: 'XAUUSDm', full_name: 'XAUUSDm', description: 'XAUUSD (m)', exchange: '', type: 'commodity' },
            { symbol: 'EURUSD', full_name: 'EURUSD', description: 'Euro vs US Dollar', exchange: '', type: 'forex' },
        ];
        const q = (userInput || '').toLowerCase();
        onResult(symbols.filter(s => s.symbol.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)));
    }

    resolveSymbol(symbolName, onResolve, onError) {
        let symbolType = 'crypto';
        let pricescale = 100;
        
        if (/USD|EUR|GBP|JPY/.test(symbolName)) pricescale = 10000;
        
        if (symbolName.startsWith('BTC') || symbolName.startsWith('ETH')) {
            symbolType = 'crypto';
        } else if (symbolName.startsWith('XAU') || symbolName.startsWith('XAG')) {
            symbolType = 'commodity';
            pricescale = 100;
        } else if (/USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD/.test(symbolName)) {
            symbolType = 'forex';
        }
        
        const info = {
            ticker: symbolName,
            name: symbolName,
            description: symbolName,
            type: symbolType,
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'FOREX',
            listed_exchange: 'FOREX',
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

    getTimeframe(resolution) {
        const m = {
            '1':'1','3':'3','5':'5','15':'15','30':'30',
            '60':'60','120':'120','240':'240','360':'360','480':'480',
            'D':'1440','1D':'1440','W':'10080','1W':'10080','M':'43200','1M':'43200'
        };
        return m[resolution] || '1';
    }

    normalizeSymbol(symbolName) {
        // Remove trailing 'm' if present (e.g., BTCUSDm -> BTCUSD)
        return symbolName.replace(/m$/i, '').toUpperCase();
    }

    async getBars(symbolInfo, resolution, periodParams, onResult, onError) {
        const { from, to, firstDataRequest } = periodParams;
        const timeframe = this.getTimeframe(resolution);
        const count = firstDataRequest ? 1000 : 500;
        
        // Normalize symbol - remove 'm' suffix for API call
        const apiSymbol = this.normalizeSymbol(symbolInfo.name);
        
        // Try both symbol variants
        const candidates = [apiSymbol];
        if (symbolInfo.name.toLowerCase().endsWith('m')) {
            candidates.push(apiSymbol + 'm');
        } else {
            candidates.push(apiSymbol.replace(/m$/i, ''));
        }

        console.log('[CustomDatafeed] getBars:', {
            symbol: symbolInfo.name,
            apiSymbol,
            resolution,
            timeframe,
            count,
            firstDataRequest
        });

        for (const sym of candidates) {
            try {
                const apiUrl = `${this.apiUrl}/chart/candle/history/${sym}?timeframe=${timeframe}&count=${count}`;
                console.log('[CustomDatafeed] Fetching:', apiUrl);
                
                const response = await fetch(apiUrl, { 
                    headers: { 'Accept': 'application/json' },
                    cache: 'no-cache' 
                });

                if (!response.ok) {
                    console.warn('[CustomDatafeed] Response not OK:', response.status, response.statusText);
                    continue;
                }

                const data = await response.json();
                console.log('[CustomDatafeed] Received data:', Array.isArray(data) ? data.length + ' candles' : 'not an array', data);

                if (!Array.isArray(data) || data.length === 0) {
                    console.warn('[CustomDatafeed] Empty or invalid data for:', sym);
                    continue;
                }

                // Transform API response to TradingView format
                const tfMs = parseInt(timeframe) * 60 * 1000;
                const bars = data
                    .map(candle => {
                        // Parse timestamp - handle ISO string or number
                        let timeMs;
                        if (typeof candle.time === 'string') {
                            timeMs = new Date(candle.time).getTime();
                        } else if (typeof candle.time === 'number') {
                            // If seconds (10 digits), convert to ms
                            timeMs = candle.time < 1e12 ? candle.time * 1000 : candle.time;
                        } else {
                            return null;
                        }

                        if (!Number.isFinite(timeMs)) return null;

                        // Align to candle boundary
                        const alignedTime = Math.floor(timeMs / tfMs) * tfMs;

                        return {
                            time: alignedTime,
                            open: parseFloat(candle.open) || 0,
                            high: parseFloat(candle.high) || 0,
                            low: parseFloat(candle.low) || 0,
                            close: parseFloat(candle.close) || 0,
                            volume: parseFloat(candle.volume || candle.tickVolume || 0)
                        };
                    })
                    .filter(bar => bar && Number.isFinite(bar.time) && Number.isFinite(bar.close) && bar.close > 0)
                    .sort((a, b) => a.time - b.time);

                if (bars.length === 0) {
                    console.warn('[CustomDatafeed] No valid bars after transformation for:', sym);
                    continue;
                }

                console.log('[CustomDatafeed] Transformed to', bars.length, 'bars');

                // Filter by time range if needed
                let finalBars;
                if (firstDataRequest) {
                    // For first request, take last 100 bars
                    finalBars = bars.slice(-Math.min(100, bars.length));
                } else if (from && to) {
                    // Filter by time range (from/to are in seconds)
                    const fromMs = from * 1000;
                    const toMs = to * 1000;
                    finalBars = bars.filter(bar => bar.time >= fromMs && bar.time <= toMs);
                    if (finalBars.length === 0) {
                        finalBars = bars.slice(-Math.min(100, bars.length));
                    }
                } else {
                    finalBars = bars.slice(-Math.min(100, bars.length));
                }

                console.log('[CustomDatafeed] Returning', finalBars.length, 'bars');
                return onResult(finalBars, { noData: finalBars.length === 0 });
            } catch (error) {
                console.error('[CustomDatafeed] Error fetching for', sym, ':', error);
                continue;
            }
        }

        // If we get here, all attempts failed
        console.error('[CustomDatafeed] getBars failed for all symbol variants');
        onError('Failed to fetch historical data');
    }

    subscribeBars(symbolInfo, resolution, onTick, listenerGuid, onResetCacheNeededCallback) {
        const timeframe = this.getTimeframe(resolution);
        const tfInt = parseInt(timeframe);
        const apiSymbol = this.normalizeSymbol(symbolInfo.name);
        
        console.log('[CustomDatafeed] subscribeBars:', {
            symbol: symbolInfo.name,
            apiSymbol,
            resolution,
            timeframe
        });

        if (tfInt === 1) {
            // Direct polling for 1-minute timeframe
            const poll = async () => {
                try {
                    const url = `${this.apiUrl}/chart/candle/current/${apiSymbol}?timeframe=1`;
                    const response = await fetch(url, { 
                        headers: { 'Accept': 'application/json' },
                        cache: 'no-cache' 
                    });

                    if (!response.ok) return;

                    const candle = await response.json();
                    const candleData = Array.isArray(candle) ? candle[0] : candle;

                    if (!candleData || !candleData.time) return;

                    // Parse timestamp
                    let timeMs;
                    if (typeof candleData.time === 'string') {
                        timeMs = new Date(candleData.time).getTime();
                    } else if (typeof candleData.time === 'number') {
                        timeMs = candleData.time < 1e12 ? candleData.time * 1000 : candleData.time;
                    } else {
                        return;
                    }

                    const timestamp = Math.floor(timeMs / (60 * 1000)) * 60 * 1000;

                    const bar = {
                        time: timestamp,
                        open: parseFloat(candleData.open || candleData.close || 0),
                        high: parseFloat(candleData.high || candleData.close || 0),
                        low: parseFloat(candleData.low || candleData.close || 0),
                        close: parseFloat(candleData.close || 0),
                        volume: parseFloat(candleData.volume || candleData.tickVolume || 0)
                    };

                    if (!Number.isFinite(bar.time) || !Number.isFinite(bar.close) || bar.close <= 0) return;

                    const last = this.lastBars[listenerGuid];

                    if (!last || bar.time > last.time) {
                        // New candle
                        this.lastBars[listenerGuid] = bar;
                        onTick(bar);
                    } else if (bar.time === last.time) {
                        // Update existing candle
                        const merged = {
                            time: last.time,
                            open: last.open,
                            high: Math.max(last.high, bar.high, bar.close),
                            low: Math.min(last.low, bar.low, bar.close),
                            close: bar.close,
                            volume: Math.max(bar.volume, last.volume || 0)
                        };
                        this.lastBars[listenerGuid] = merged;
                        onTick(merged);
                    }
                } catch (error) {
                    console.error('[CustomDatafeed] Polling error:', error);
                }
            };

            poll();
            this.subscribers[listenerGuid] = setInterval(poll, 1000); // Poll every 1 second
        } else {
            // Aggregate from 1-minute for higher timeframes
            const bucketMs = tfInt * 60 * 1000;
            const pollAgg = async () => {
                try {
                    const url = `${this.apiUrl}/chart/candle/current/${apiSymbol}?timeframe=1`;
                    const response = await fetch(url, { 
                        headers: { 'Accept': 'application/json' },
                        cache: 'no-cache' 
                    });

                    if (!response.ok) return;

                    const candle = await response.json();
                    const candleData = Array.isArray(candle) ? candle[0] : candle;

                    if (!candleData || !candleData.time) return;

                    let timeMs;
                    if (typeof candleData.time === 'string') {
                        timeMs = new Date(candleData.time).getTime();
                    } else if (typeof candleData.time === 'number') {
                        timeMs = candleData.time < 1e12 ? candleData.time * 1000 : candleData.time;
                    } else {
                        return;
                    }

                    const oneTime = Math.floor(timeMs / (60 * 1000)) * 60 * 1000;
                    const bucketTime = Math.floor(oneTime / bucketMs) * bucketMs;

                    const oneBar = {
                        time: oneTime,
                        open: parseFloat(candleData.open || candleData.close || 0),
                        high: parseFloat(candleData.high || candleData.close || 0),
                        low: parseFloat(candleData.low || candleData.close || 0),
                        close: parseFloat(candleData.close || 0),
                        volume: parseFloat(candleData.volume || candleData.tickVolume || 0)
                    };

                    let agg = this.aggregators[listenerGuid];

                    if (!agg || bucketTime > agg.time) {
                        // New aggregated candle
                        agg = {
                            time: bucketTime,
                            open: oneBar.open,
                            high: oneBar.high,
                            low: oneBar.low,
                            close: oneBar.close,
                            volume: oneBar.volume
                        };
                        this.aggregators[listenerGuid] = agg;
                        this.lastBars[listenerGuid] = { ...agg };
                        if (typeof onResetCacheNeededCallback === 'function') {
                            try {
                                onResetCacheNeededCallback();
                            } catch {}
                        }
                        onTick({ ...agg });
                    } else {
                        // Update existing aggregated candle
                        agg.high = Math.max(agg.high, oneBar.high, oneBar.close);
                        agg.low = Math.min(agg.low, oneBar.low, oneBar.close);
                        agg.close = oneBar.close;
                        agg.volume = Math.max(agg.volume || 0, oneBar.volume || 0);
                        this.aggregators[listenerGuid] = agg;
                        this.lastBars[listenerGuid] = { ...agg };
                        onTick({ ...agg });
                    }
                } catch (error) {
                    console.error('[CustomDatafeed] Aggregation polling error:', error);
                }
            };

            pollAgg();
            this.subscribers[listenerGuid] = setInterval(pollAgg, 1000);
        }
    }

    unsubscribeBars(listenerGuid) {
        if (this.subscribers[listenerGuid]) {
            clearInterval(this.subscribers[listenerGuid]);
            delete this.subscribers[listenerGuid];
        }
        delete this.lastBars[listenerGuid];
        delete this.aggregators[listenerGuid];
    }

    getServerTime(cb) {
        try {
            cb(Math.floor(Date.now() / 1000));
        } catch {
            // noop
        }
    }
}

// Export for browser usage
if (typeof window !== 'undefined') {
    window.CustomDatafeed = CustomDatafeed;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CustomDatafeed;
}
