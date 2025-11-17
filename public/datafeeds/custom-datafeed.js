// Custom MT5-compatible Datafeed (uses the TradingView Library)
// Simplified implementation following the architecture guide
// Browser-only - should not be executed during SSR
(function(global) {
  // Guard: Only execute in browser environment
  if (typeof window === 'undefined' && typeof globalThis !== 'undefined' && !globalThis.window) {
    return;
  }

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
        
        // Try both symbol variants - start with the original symbol first
        const candidates = [symbolInfo.name];
        if (!symbolInfo.name.toLowerCase().endsWith('m')) {
            candidates.push(apiSymbol + 'm');
        }
        candidates.push(apiSymbol);
        // Remove duplicates
        const uniqueCandidates = [...new Set(candidates)];

        console.log('[CustomDatafeed] getBars:', {
            symbol: symbolInfo.name,
            apiSymbol,
            candidates: uniqueCandidates,
            resolution,
            timeframe,
            count,
            firstDataRequest,
            from: from ? new Date(from * 1000).toISOString() : null,
            to: to ? new Date(to * 1000).toISOString() : null
        });

        for (const sym of uniqueCandidates) {
            try {
                const apiUrl = `${this.apiUrl}/chart/candle/history/${sym}?timeframe=${timeframe}&count=${count}`;
                console.log('[CustomDatafeed] Fetching:', apiUrl);
                
                const response = await fetch(apiUrl, { 
                    headers: { 'Accept': 'application/json' },
                    cache: 'no-cache' 
                });

                console.log('[CustomDatafeed] Response status:', response.status, response.statusText, 'for', sym);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => '');
                    console.warn('[CustomDatafeed] Response not OK:', response.status, response.statusText, errorText.substring(0, 200));
                    continue;
                }

                const data = await response.json();
                console.log('[CustomDatafeed] Received data for', sym, ':', {
                    isArray: Array.isArray(data),
                    length: Array.isArray(data) ? data.length : 'N/A',
                    firstItem: Array.isArray(data) && data.length > 0 ? data[0] : data
                });

                if (!Array.isArray(data)) {
                    console.error('[CustomDatafeed] Data is not an array for:', sym, 'Got:', typeof data, data);
                    continue;
                }

                if (data.length === 0) {
                    console.warn('[CustomDatafeed] Empty array for:', sym);
                    continue;
                }

                // Transform API response to TradingView format
                const tfMs = parseInt(timeframe) * 60 * 1000;
                let transformErrors = 0;
                const bars = data
                    .map((candle, idx) => {
                        try {
                            // Parse timestamp - handle ISO string or number
                            let timeMs;
                            if (typeof candle.time === 'string') {
                                timeMs = new Date(candle.time).getTime();
                            } else if (typeof candle.time === 'number') {
                                // If seconds (10 digits), convert to ms
                                timeMs = candle.time < 1e12 ? candle.time * 1000 : candle.time;
                            } else {
                                transformErrors++;
                                return null;
                            }

                            if (!Number.isFinite(timeMs)) {
                                transformErrors++;
                                return null;
                            }

                            // Align to candle boundary
                            const alignedTime = Math.floor(timeMs / tfMs) * tfMs;

                            // Extract OHLC values - handle both PascalCase (API) and camelCase variations
                            const open = parseFloat(candle.open || candle.Open || candle.close || candle.Close || 0);
                            const high = parseFloat(candle.high || candle.High || candle.close || candle.Close || 0);
                            const low = parseFloat(candle.low || candle.Low || candle.close || candle.Close || 0);
                            const close = parseFloat(candle.close || candle.Close || 0);
                            const volume = parseFloat(candle.volume || candle.Volume || candle.tickVolume || candle.TickVolume || 0);

                            if (!Number.isFinite(close) || close <= 0) {
                                transformErrors++;
                                return null;
                            }

                            // Ensure OHLC integrity: High >= max(Open, Close), Low <= min(Open, Close)
                            const validatedHigh = Math.max(high, open, close);
                            const validatedLow = Math.min(low, open, close);

                            // Return complete OHLC bar data for candlestick chart
                return {
                                time: alignedTime,
                                open: Number.isFinite(open) ? open : close,
                                high: Number.isFinite(validatedHigh) ? validatedHigh : Math.max(open, close),
                                low: Number.isFinite(validatedLow) ? validatedLow : Math.min(open, close),
                                close: close,
                                volume: Number.isFinite(volume) ? volume : 0
                            };
                        } catch (e) {
                            transformErrors++;
                            console.warn('[CustomDatafeed] Error transforming candle', idx, ':', e);
                            return null;
                        }
                    })
                    .filter(bar => bar !== null)
                    .sort((a, b) => a.time - b.time);

                if (transformErrors > 0) {
                    console.warn('[CustomDatafeed] Transform errors:', transformErrors, 'out of', data.length);
                }

                if (bars.length === 0) {
                    console.warn('[CustomDatafeed] No valid bars after transformation for:', sym);
                    continue;
                }

                console.log('[CustomDatafeed] Transformed to', bars.length, 'bars (had', transformErrors, 'errors)');

                // Filter by time range if needed
            let finalBars;
            if (firstDataRequest) {
                    // For first request, take last 200 bars to ensure we have enough
                    finalBars = bars.slice(-Math.min(200, bars.length));
                    console.log('[CustomDatafeed] First request: returning last', finalBars.length, 'bars');
                } else if (from && to) {
                    // Filter by time range (from/to are in seconds)
                    const fromMs = from * 1000;
                    const toMs = to * 1000;
                    finalBars = bars.filter(bar => bar.time >= fromMs && bar.time <= toMs);
                    console.log('[CustomDatafeed] Range request: filtered', bars.length, '->', finalBars.length, 'bars');
                    if (finalBars.length === 0) {
                        // Fallback: return last 100 bars if no match in range
                finalBars = bars.slice(-Math.min(100, bars.length));
                        console.log('[CustomDatafeed] Range empty, using fallback:', finalBars.length, 'bars');
                    }
                } else {
                    finalBars = bars.slice(-Math.min(100, bars.length));
                    console.log('[CustomDatafeed] Default: returning last', finalBars.length, 'bars');
                }

                if (finalBars.length > 0) {
                    console.log('[CustomDatafeed] ✅ Success! Returning', finalBars.length, 'bars. First:', {
                        time: new Date(finalBars[0].time).toISOString(),
                        close: finalBars[0].close
                    }, 'Last:', {
                        time: new Date(finalBars[finalBars.length - 1].time).toISOString(),
                        close: finalBars[finalBars.length - 1].close
                    });
                }
                
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
            // Direct polling for 1-minute timeframe - update every 200ms using OHLC + bid/ask
            const poll = async () => {
                try {
                    // Fetch both current candle (OHLC) and live tick (bid/ask) in parallel for smooth updates
                    const [candleResponse, tickResponse] = await Promise.all([
                        fetch(`${this.apiUrl}/chart/candle/current/${apiSymbol}?timeframe=1`, { 
                            headers: { 'Accept': 'application/json' },
                            cache: 'no-cache' 
                        }).catch(() => null),
                        fetch(`${this.apiUrl}/livedata/tick/${apiSymbol}`, { 
                            headers: { 'Accept': 'application/json' },
                            cache: 'no-cache' 
                        }).catch(() => null)
                    ]);

                    let candleData = null;
                    let tickData = null;

                    // Parse candle data
                    if (candleResponse && candleResponse.ok) {
                        const candle = await candleResponse.json();
                        candleData = Array.isArray(candle) ? candle[0] : candle;
                    }

                    // Parse tick data (bid/ask)
                    if (tickResponse && tickResponse.ok) {
                        tickData = await tickResponse.json();
                    }

                    // If we have candle data, use it; otherwise skip
                    if (!candleData || !candleData.time) {
                        if (!tickData) return; // Need at least one data source
                    }

                    // Extract OHLC from current candle API response
                    const candleOpen = candleData ? parseFloat(candleData.open || candleData.Open || candleData.close || candleData.Close || 0) : null;
                    const candleHigh = candleData ? parseFloat(candleData.high || candleData.High || candleData.close || candleData.Close || 0) : null;
                    const candleLow = candleData ? parseFloat(candleData.low || candleData.Low || candleData.close || candleData.Close || 0) : null;
                    const candleClose = candleData ? parseFloat(candleData.close || candleData.Close || 0) : null;
                    const volume = candleData ? parseFloat(candleData.volume || candleData.Volume || candleData.tickVolume || candleData.TickVolume || 0) : 0;

                    // Extract bid/ask from live tick data
                    const bid = tickData ? parseFloat(tickData.bid || tickData.Bid || tickData.last || tickData.Last || 0) : null;
                    const ask = tickData ? parseFloat(tickData.ask || tickData.Ask || tickData.last || tickData.Last || 0) : null;
                    const last = tickData ? parseFloat(tickData.last || tickData.Last || tickData.close || tickData.Close || 0) : null;

                    // Use tick data for close price if available (more real-time), otherwise use candle
                    const currentPrice = last || ask || bid || candleClose;
                    if (!currentPrice || !Number.isFinite(currentPrice) || currentPrice <= 0) {
                        return;
                    }

                    // Parse timestamp from candle or use current time
                    let timeMs;
                    if (candleData && candleData.time) {
                        if (typeof candleData.time === 'string') {
                            timeMs = new Date(candleData.time).getTime();
                        } else if (typeof candleData.time === 'number') {
                            timeMs = candleData.time < 1e12 ? candleData.time * 1000 : candleData.time;
                        } else {
                            timeMs = Date.now();
                        }
                    } else {
                        timeMs = Date.now();
                    }

                    const timestamp = Math.floor(timeMs / (60 * 1000)) * 60 * 1000;

                    const lastBar = this.lastBars[listenerGuid];

                    // Determine open price
                    let open = candleOpen;
                    if (!open || !Number.isFinite(open)) {
                        // Use previous candle's close if available, otherwise current price
                        open = lastBar ? lastBar.close : currentPrice;
                    }

                    // Determine high/low using both candle OHLC and current bid/ask
                    let high = candleHigh;
                    let low = candleLow;

                    // Update high/low with current bid/ask for real-time movement
                    if (bid && Number.isFinite(bid)) {
                        high = high ? Math.max(high, bid) : bid;
                        low = low ? Math.min(low, bid) : bid;
                    }
                    if (ask && Number.isFinite(ask)) {
                        high = high ? Math.max(high, ask) : ask;
                        low = low ? Math.min(low, ask) : ask;
                    }
                    if (currentPrice && Number.isFinite(currentPrice)) {
                        high = high ? Math.max(high, currentPrice) : currentPrice;
                        low = low ? Math.min(low, currentPrice) : currentPrice;
                    }

                    // Ensure OHLC integrity: High >= max(Open, Close), Low <= min(Open, Close)
                    const validatedHigh = Math.max(high || currentPrice, open, currentPrice);
                    const validatedLow = Math.min(low || currentPrice, open, currentPrice);

                    // Create complete OHLC bar with real-time updates
                    const bar = {
                        time: timestamp,
                        open: Number.isFinite(open) ? open : currentPrice,
                        high: Number.isFinite(validatedHigh) ? validatedHigh : Math.max(open, currentPrice),
                        low: Number.isFinite(validatedLow) ? validatedLow : Math.min(open, currentPrice),
                        close: currentPrice,
                        volume: Number.isFinite(volume) ? volume : 0
                    };

                    if (!Number.isFinite(bar.time) || !Number.isFinite(bar.close) || bar.close <= 0) {
                        return;
                    }

                    if (!lastBar || bar.time > lastBar.time) {
                        // New candle - use complete OHLC from candle API
                        if (candleData && candleOpen && Number.isFinite(candleOpen)) {
                            bar.open = candleOpen;
                            bar.high = Math.max(candleHigh || candleOpen, candleOpen, currentPrice);
                            bar.low = Math.min(candleLow || candleOpen, candleOpen, currentPrice);
                        }
                        this.lastBars[listenerGuid] = bar;
                        onTick(bar);
                    } else if (bar.time === lastBar.time) {
                        // Update existing candle - merge with previous and update with bid/ask
                        const merged = {
                            time: lastBar.time,
                            open: lastBar.open, // Open never changes once candle starts
                            high: Math.max(lastBar.high, bar.high, currentPrice),
                            low: Math.min(lastBar.low, bar.low, currentPrice),
                            close: currentPrice, // Always update close with latest price
                            volume: Math.max(lastBar.volume || 0, bar.volume || 0)
                        };
                        this.lastBars[listenerGuid] = merged;
                        onTick(merged);
                    }
                } catch (error) {
                    console.error('[CustomDatafeed] Polling error:', error);
                }
            };

            poll();
            // Poll every 200ms for smooth real-time price movement
            this.subscribers[listenerGuid] = setInterval(poll, 200);
        } else {
            // Aggregate from 1-minute for higher timeframes
            const bucketMs = tfInt * 60 * 1000;
        const pollAgg = async () => {
            try {
                    // Fetch both current candle (OHLC) and live tick (bid/ask) for real-time aggregation
                    const [candleResponse, tickResponse] = await Promise.all([
                        fetch(`${this.apiUrl}/chart/candle/current/${apiSymbol}?timeframe=1`, { 
                            headers: { 'Accept': 'application/json' },
                            cache: 'no-cache' 
                        }).catch(() => null),
                        fetch(`${this.apiUrl}/livedata/tick/${apiSymbol}`, { 
                            headers: { 'Accept': 'application/json' },
                            cache: 'no-cache' 
                        }).catch(() => null)
                    ]);

                    let candleData = null;
                    let tickData = null;

                    if (candleResponse && candleResponse.ok) {
                        const candle = await candleResponse.json();
                        candleData = Array.isArray(candle) ? candle[0] : candle;
                    }

                    if (tickResponse && tickResponse.ok) {
                        tickData = await tickResponse.json();
                    }

                    if (!candleData || !candleData.time) {
                        if (!tickData) return;
                    }

                    // Extract OHLC from current candle for aggregation
                    const open = candleData ? parseFloat(candleData.open || candleData.Open || candleData.close || candleData.Close || 0) : null;
                    const high = candleData ? parseFloat(candleData.high || candleData.High || candleData.close || candleData.Close || 0) : null;
                    const low = candleData ? parseFloat(candleData.low || candleData.Low || candleData.close || candleData.Close || 0) : null;
                    const close = candleData ? parseFloat(candleData.close || candleData.Close || 0) : null;
                    const volume = candleData ? parseFloat(candleData.volume || candleData.Volume || candleData.tickVolume || candleData.TickVolume || 0) : 0;

                    // Extract bid/ask from live tick for real-time price updates
                    const bid = tickData ? parseFloat(tickData.bid || tickData.Bid || tickData.last || tickData.Last || 0) : null;
                    const ask = tickData ? parseFloat(tickData.ask || tickData.Ask || tickData.last || tickData.Last || 0) : null;
                    const last = tickData ? parseFloat(tickData.last || tickData.Last || tickData.close || tickData.Close || 0) : null;
                    const currentPrice = last || ask || bid || close;

                    if (!currentPrice || !Number.isFinite(currentPrice) || currentPrice <= 0) {
                        return;
                    }

                    let timeMs;
                    if (candleData && candleData.time) {
                        if (typeof candleData.time === 'string') {
                            timeMs = new Date(candleData.time).getTime();
                        } else if (typeof candleData.time === 'number') {
                            timeMs = candleData.time < 1e12 ? candleData.time * 1000 : candleData.time;
                        } else {
                            timeMs = Date.now();
                        }
                    } else {
                        timeMs = Date.now();
                    }

                    const oneTime = Math.floor(timeMs / (60 * 1000)) * 60 * 1000;
                    const bucketTime = Math.floor(oneTime / bucketMs) * bucketMs;

                    // Update high/low with bid/ask for real-time movement
                    let validatedHigh = high || currentPrice;
                    let validatedLow = low || currentPrice;

                    if (bid && Number.isFinite(bid)) {
                        validatedHigh = Math.max(validatedHigh, bid);
                        validatedLow = Math.min(validatedLow, bid);
                    }
                    if (ask && Number.isFinite(ask)) {
                        validatedHigh = Math.max(validatedHigh, ask);
                        validatedLow = Math.min(validatedLow, ask);
                    }
                    if (currentPrice && Number.isFinite(currentPrice)) {
                        validatedHigh = Math.max(validatedHigh, currentPrice);
                        validatedLow = Math.min(validatedLow, currentPrice);
                    }

                    // Ensure OHLC integrity
                    validatedHigh = Math.max(validatedHigh, open || currentPrice, currentPrice);
                    validatedLow = Math.min(validatedLow, open || currentPrice, currentPrice);

                    // Create 1-minute bar with complete OHLC data including bid/ask updates
                    const oneBar = {
                        time: oneTime,
                        open: Number.isFinite(open) ? open : currentPrice,
                        high: Number.isFinite(validatedHigh) ? validatedHigh : Math.max(open || currentPrice, currentPrice),
                        low: Number.isFinite(validatedLow) ? validatedLow : Math.min(open || currentPrice, currentPrice),
                        close: currentPrice,
                        volume: Number.isFinite(volume) ? volume : 0
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
            // Poll every 200ms for smoother updates even for aggregated timeframes
            this.subscribers[listenerGuid] = setInterval(pollAgg, 200);
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

// Export for Node.js (only if not in browser)
if (typeof module !== 'undefined' && module.exports && typeof window === 'undefined') {
    module.exports = CustomDatafeed; 
}
})(typeof window !== 'undefined' ? window : globalThis);
