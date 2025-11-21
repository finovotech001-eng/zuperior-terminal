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
        const normalizeBase = (val, fallback) => {
            const base = (val || fallback || '').replace(/\/$/, '');
            // Ensure we always hit the upstream /api prefix when using a direct domain
            if (base && !base.endsWith('/api') && base.startsWith('http')) {
                return `${base}/api`;
            }
            return base || '/apis';
        };
        this.apiUrl = normalizeBase(cfg.baseUrl, '/apis');
        // fallbackApiUrl allows bypassing Next.js proxy if it fails (CORS-permitting)
        this.fallbackApiUrl = normalizeBase(
            cfg.fallbackBaseUrl ||
            (typeof window !== 'undefined' ? window.__ZUPERIOR_DIRECT_API_BASE__ : undefined) ||
            'https://metaapi.zuperior.com/api',
            'https://metaapi.zuperior.com/api'
        );
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
        const count = firstDataRequest ? 450 : 250; // smaller payload to load faster
        
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

        const baseCandidates = [this.apiUrl, this.fallbackApiUrl].filter(Boolean);

        for (const sym of uniqueCandidates) {
            try {
                let data = null;
                let lastStatus = 0;

                const buildHistoryUrl = (base, symbol) => {
                    // MetaAPI requires capital C in Chart for history
                    const needsCapitalChart = /metaapi|zuperior/i.test(base);
                    const pathPrefix = needsCapitalChart ? 'Chart' : 'chart';
                    return `${base}/${pathPrefix}/candle/history/${symbol}?timeframe=${timeframe}&count=${count}`;
                };

                const fetchWithTimeout = async (url, ms = 4500) => {
                    const ctrl = new AbortController();
                    const t = setTimeout(() => ctrl.abort(), ms);
                    try {
                        return await fetch(url, { headers: { 'Accept': 'application/json' }, cache: 'no-cache', signal: ctrl.signal });
                    } finally {
                        clearTimeout(t);
                    }
                };

                for (const base of baseCandidates) {
                    const apiUrl = buildHistoryUrl(base, sym);
                    console.log('[CustomDatafeed] Fetching:', apiUrl);
                    
                    const response = await fetchWithTimeout(apiUrl).catch(() => null);
            
                    if (!response) {
                        console.warn('[CustomDatafeed] No response (timeout/abort) for', apiUrl);
                        continue;
                    }

                    lastStatus = response.status;
                    console.log('[CustomDatafeed] Response status:', response.status, response.statusText, 'for', sym, 'via', base);

                    if (!response.ok) {
                        const errorText = await response.text().catch(() => '');
                        console.warn('[CustomDatafeed] Response not OK:', response.status, response.statusText, errorText.substring(0, 200));
                        continue;
                    }

                    data = await response.json().catch(() => null);
                    console.log('[CustomDatafeed] Received data for', sym, 'via', base, ':', {
                        isArray: Array.isArray(data),
                        length: Array.isArray(data) ? data.length : 'N/A',
                        firstItem: Array.isArray(data) && data.length > 0 ? data[0] : data
                    });

                    if (data) break;
                }

                if (!data) {
                    console.warn('[CustomDatafeed] No data returned for', sym, 'after trying', baseCandidates.length, 'bases');
                    continue;
                }

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

                            // Extract OHLC values - handle both PascalCase (API) and camelCase variations.
                            // Do NOT invent OHLC from close – if any leg is missing, drop the bar instead of
                            // drawing a fake flat candle.
                            const open = parseFloat(candle.open != null ? candle.open : candle.Open);
                            const high = parseFloat(candle.high != null ? candle.high : candle.High);
                            const low = parseFloat(candle.low != null ? candle.low : candle.Low);
                            const close = parseFloat(candle.close != null ? candle.close : candle.Close);
                            const volume = parseFloat(candle.volume || candle.Volume || candle.tickVolume || candle.TickVolume || 0);

                            if (
                                !Number.isFinite(open) ||
                                !Number.isFinite(high) ||
                                !Number.isFinite(low) ||
                                !Number.isFinite(close) ||
                                close <= 0
                            ) {
                                transformErrors++;
                                return null;
                            }

                            // Ensure OHLC integrity: High >= max(Open, Close), Low <= min(Open, Close)
                            const validatedHigh = Math.max(high, open, close);
                            const validatedLow = Math.min(low, open, close);

                            // Return complete OHLC bar data for candlestick chart
                return {
                                time: alignedTime,
                                open,
                                high: validatedHigh,
                                low: validatedLow,
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

        // If we get here, all attempts failed or produced no valid bars.
        // Signal "no data" instead of a hard error so the chart can render
        // an empty state instead of hanging on "Loading...".
        console.error('[CustomDatafeed] getBars: no valid data for any symbol variant');
        try {
            onResult([], { noData: true });
        } catch (e) {
            console.error('[CustomDatafeed] getBars onResult error:', e);
            if (onError) {
                onError('Failed to fetch historical data');
            }
        }
    }

    subscribeBars(symbolInfo, resolution, onTick, listenerGuid, onResetCacheNeededCallback) {
        const timeframe = this.getTimeframe(resolution);
        const tfInt = parseInt(timeframe);
        const apiSymbol = this.normalizeSymbol(symbolInfo.name);
        const baseCandidates = [this.apiUrl, this.fallbackApiUrl].filter(Boolean);
        
        console.log('[CustomDatafeed] subscribeBars:', {
            symbol: symbolInfo.name,
            apiSymbol,
            resolution,
            timeframe
        });

        if (tfInt === 1) {
            // Direct polling for 1-minute timeframe - update every ~200ms using OHLC from the server,
            // optionally refined by the latest tick. We keep the candle structure strictly OHLC-based.
            const poll = async () => {
                try {
                    // Fetch both current candle (OHLC) and live tick (bid/ask) in parallel for smooth updates
                    const [candleResponse, tickResponse] = await Promise.all([
                        (async () => {
                            for (const base of baseCandidates) {
                                const url = `${base}/chart/candle/current/${apiSymbol}?timeframe=1`;
                                const resp = await fetch(url, { 
                                    headers: { 'Accept': 'application/json' },
                                    cache: 'no-cache' 
                                }).catch(() => null);
                                if (resp && resp.ok) return resp;
                            }
                            return null;
                        })(),
                        (async () => {
                            for (const base of baseCandidates) {
                                const url = `${base}/livedata/tick/${apiSymbol}`;
                                const resp = await fetch(url, { 
                                    headers: { 'Accept': 'application/json' },
                                    cache: 'no-cache' 
                                }).catch(() => null);
                                if (resp && resp.ok) return resp;
                            }
                            return null;
                        })()
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
                    const candleOpen = candleData ? parseFloat(candleData.open != null ? candleData.open : candleData.Open) : NaN;
                    const candleHigh = candleData ? parseFloat(candleData.high != null ? candleData.high : candleData.High) : NaN;
                    const candleLow = candleData ? parseFloat(candleData.low != null ? candleData.low : candleData.Low) : NaN;
                    const candleClose = candleData ? parseFloat(candleData.close != null ? candleData.close : candleData.Close) : NaN;
                    const volume = candleData ? parseFloat(candleData.volume || candleData.Volume || candleData.tickVolume || candleData.TickVolume || 0) : 0;

                    // Require a valid OHLC set from the server; do not invent from close.
                    if (
                        !Number.isFinite(candleOpen) ||
                        !Number.isFinite(candleHigh) ||
                        !Number.isFinite(candleLow) ||
                        !Number.isFinite(candleClose) ||
                        candleClose <= 0
                    ) {
                        return;
                    }

                    // Extract bid/ask/last from live tick data (optional, used only to refine high/low/close)
                    const bid = tickData ? parseFloat(tickData.bid || tickData.Bid || tickData.last || tickData.Last || 0) : null;
                    const ask = tickData ? parseFloat(tickData.ask || tickData.Ask || tickData.last || tickData.Last || 0) : null;
                    const last = tickData ? parseFloat(tickData.last || tickData.Last || tickData.close || tickData.Close || 0) : null;

                    // Use tick data for close/high/low refinement if available; otherwise use candle close.
                    const tickPrice = last || ask || bid;

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
                    const currentTime = Date.now();
                    const currentCandleTime = Math.floor(currentTime / (60 * 1000)) * 60 * 1000;

                    // Only update if this is the CURRENT (incomplete) candle
                    // Completed candles should NEVER be updated
                    if (timestamp < currentCandleTime) {
                        // This is a completed candle - don't touch it, it's already in history
                        return;
                    }

                    const lastBar = this.lastBars[listenerGuid];

                    if (!lastBar || timestamp > lastBar.time) {
                        // NEW candle period starting
                        // CRITICAL: New candle's OPEN must equal previous candle's CLOSE for continuity
                        if (!tickPrice || !Number.isFinite(tickPrice) || tickPrice <= 0) {
                            return; // Need tick data to start new candle
                        }

                        // For new candle, open = previous candle's close (ensures continuity)
                        // If no previous candle, use tick price or API open
                        let newOpen;
                        if (lastBar && Number.isFinite(lastBar.close)) {
                            // New candle starts where previous one ended
                            newOpen = lastBar.close;
                        } else if (Number.isFinite(candleOpen) && timestamp === currentCandleTime) {
                            // First candle or API provides open for current candle
                            newOpen = candleOpen;
                        } else {
                            // Fallback: use tick price
                            newOpen = tickPrice;
                        }
                        
                        const newBar = {
                            time: timestamp,
                            open: newOpen,
                            high: tickPrice,
                            low: tickPrice,
                            close: tickPrice,
                            volume: Number.isFinite(volume) ? volume : 0
                        };

                        this.lastBars[listenerGuid] = newBar;
                        onTick(newBar);
                    } else if (timestamp === lastBar.time) {
                        // CURRENT candle (same time period) - ONLY update high/low/close from tick
                        // NEVER use API OHLC here as it might be from a completed candle
                        if (!tickPrice || !Number.isFinite(tickPrice) || tickPrice <= 0) {
                            return;
                        }

                        // Update only high, low, close from tick data - open NEVER changes
                        const updatedBar = {
                            time: lastBar.time,
                            open: lastBar.open, // OPEN NEVER CHANGES once candle starts
                            high: Math.max(lastBar.high, tickPrice), // Expand high if price goes up
                            low: Math.min(lastBar.low, tickPrice),   // Expand low if price goes down
                            close: tickPrice, // Always update close with latest tick
                            volume: Math.max(lastBar.volume || 0, volume || 0)
                        };

                        this.lastBars[listenerGuid] = updatedBar;
                        onTick(updatedBar);
                    }
                    // If timestamp < lastBar.time, candle is already completed - ignore
                } catch (error) {
                    console.error('[CustomDatafeed] Polling error:', error);
                }
            };

            poll();
            // Poll every 200ms for smooth real-time price movement
            this.subscribers[listenerGuid] = setInterval(poll, 200);
        } else {
            // Higher timeframes: poll the server for the proper aggregated OHLC candle
            // for the requested timeframe. We avoid building synthetic candles from ticks.
        const pollAgg = async () => {
            try {
                    const [candleResponse, tickResponse] = await Promise.all([
                        (async () => {
                            for (const base of baseCandidates) {
                                const url = `${base}/chart/candle/current/${apiSymbol}?timeframe=${tfInt}`;
                                const resp = await fetch(url, {
                                    headers: { 'Accept': 'application/json' },
                                    cache: 'no-cache'
                                }).catch(() => null);
                                if (resp && resp.ok) return resp;
                            }
                            return null;
                        })(),
                        (async () => {
                            for (const base of baseCandidates) {
                                const url = `${base}/livedata/tick/${apiSymbol}`;
                                const resp = await fetch(url, {
                                    headers: { 'Accept': 'application/json' },
                                    cache: 'no-cache'
                                }).catch(() => null);
                                if (resp && resp.ok) return resp;
                            }
                            return null;
                        })()
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

                    const open = candleData ? parseFloat(candleData.open != null ? candleData.open : candleData.Open) : NaN;
                    const high = candleData ? parseFloat(candleData.high != null ? candleData.high : candleData.High) : NaN;
                    const low = candleData ? parseFloat(candleData.low != null ? candleData.low : candleData.Low) : NaN;
                    const close = candleData ? parseFloat(candleData.close != null ? candleData.close : candleData.Close) : NaN;
                    const volume = candleData ? parseFloat(candleData.volume || candleData.Volume || candleData.tickVolume || candleData.TickVolume || 0) : 0;

                    if (
                        !Number.isFinite(open) ||
                        !Number.isFinite(high) ||
                        !Number.isFinite(low) ||
                        !Number.isFinite(close) ||
                        close <= 0
                    ) {
                        return;
                    }

                    // Optional tick refinement
                    const bid = tickData ? parseFloat(tickData.bid || tickData.Bid || tickData.last || tickData.Last || 0) : null;
                    const ask = tickData ? parseFloat(tickData.ask || tickData.Ask || tickData.last || tickData.Last || 0) : null;
                    const last = tickData ? parseFloat(tickData.last || tickData.Last || tickData.close || tickData.Close || 0) : null;
                    const tickPrice = last || ask || bid;

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

                    const bucketMs = tfInt * 60 * 1000;
                    const bucketTime = Math.floor(timeMs / bucketMs) * bucketMs;
                    const currentTime = Date.now();
                    const currentBucketTime = Math.floor(currentTime / bucketMs) * bucketMs;

                    // Only update if this is the CURRENT (incomplete) candle
                    // Completed candles should NEVER be updated
                    if (bucketTime < currentBucketTime) {
                        // This is a completed candle - don't touch it
                        return;
                    }

                    const lastBar = this.lastBars[listenerGuid];

                    if (!lastBar || bucketTime > lastBar.time) {
                        // NEW candle period starting
                        // CRITICAL: New candle's OPEN must equal previous candle's CLOSE for continuity
                        if (!tickPrice || !Number.isFinite(tickPrice) || tickPrice <= 0) {
                            if (!Number.isFinite(close) || close <= 0) {
                                return; // Need at least tick or candle data
                            }
                            // Fallback to candle data if no tick
                            let newOpen;
                            if (lastBar && Number.isFinite(lastBar.close)) {
                                // New candle starts where previous one ended
                                newOpen = lastBar.close;
                            } else {
                                newOpen = Number.isFinite(open) ? open : close;
                            }
                            
                            const newBar = {
                                time: bucketTime,
                                open: newOpen,
                                high: Number.isFinite(high) ? high : close,
                                low: Number.isFinite(low) ? low : close,
                                close: close,
                                volume: Number.isFinite(volume) ? volume : 0
                            };
                            this.aggregators[listenerGuid] = { ...newBar };
                            this.lastBars[listenerGuid] = { ...newBar };
                            if (typeof onResetCacheNeededCallback === 'function') {
                                try {
                                    onResetCacheNeededCallback();
                                } catch {}
                            }
                            onTick({ ...newBar });
                            return;
                        }

                        // For new candle, open = previous candle's close (ensures continuity)
                        let newOpen;
                        if (lastBar && Number.isFinite(lastBar.close)) {
                            // New candle starts where previous one ended
                            newOpen = lastBar.close;
                        } else if (Number.isFinite(open) && bucketTime === currentBucketTime) {
                            // First candle or API provides open for current candle
                            newOpen = open;
                        } else {
                            // Fallback: use tick price
                            newOpen = tickPrice;
                        }
                        
                        const newBar = {
                            time: bucketTime,
                            open: newOpen,
                            high: tickPrice,
                            low: tickPrice,
                            close: tickPrice,
                            volume: Number.isFinite(volume) ? volume : 0
                        };

                        this.aggregators[listenerGuid] = { ...newBar };
                        this.lastBars[listenerGuid] = { ...newBar };
                        if (typeof onResetCacheNeededCallback === 'function') {
                            try {
                                onResetCacheNeededCallback();
                            } catch {}
                        }
                        onTick({ ...newBar });
                    } else if (bucketTime === lastBar.time) {
                        // CURRENT candle (same time period) - ONLY update high/low/close from tick
                        // NEVER use API OHLC here as it might be from a completed candle
                        if (!tickPrice || !Number.isFinite(tickPrice) || tickPrice <= 0) {
                            return; // Need tick to update current candle
                        }

                        // Update only high, low, close from tick - open NEVER changes
                        const agg = {
                            time: lastBar.time,
                            open: lastBar.open, // OPEN NEVER CHANGES once candle starts
                            high: Math.max(lastBar.high, tickPrice), // Expand high if price goes up
                            low: Math.min(lastBar.low, tickPrice),   // Expand low if price goes down
                            close: tickPrice, // Always update close with latest tick
                            volume: Math.max(lastBar.volume || 0, volume || 0)
                        };

                        this.aggregators[listenerGuid] = { ...agg };
                        this.lastBars[listenerGuid] = { ...agg };
                        onTick({ ...agg });
                    }
                    // If bucketTime < lastBar.time, candle is already completed - ignore
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
