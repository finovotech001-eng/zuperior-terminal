// MT5 Datafeed for TradingView Charting Library
// Connects to MT5 API via CORS proxy for real-time candlestick data

class MT5Datafeed {
    constructor(proxyUrl = 'http://localhost:3000/api') {
        this.apiUrl = proxyUrl;
        this.subscribers = {};
        this.lastBars = {};
        this.aggregators = {};
    }

    // REQUIRED: Called when the library needs to know the configuration
    onReady(callback) {
        console.log('[MT5Datafeed]: onReady');
        setTimeout(() => {
            callback({
                supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', 'D', 'W', 'M'],
                supports_marks: false,
                supports_timescale_marks: false,
                supports_time: true,
                supports_search: true,
                supports_group_request: false,
            });
        }, 0);
    }

    // OPTIONAL: Search symbols (simplified - you can enhance this)
    searchSymbols(userInput, exchange, symbolType, onResult) {
        console.log('[MT5Datafeed]: searchSymbols', userInput);
        
        // Common MT5 symbols
        const symbols = [
            { symbol: 'BTCUSD', full_name: 'BTCUSD', description: 'Bitcoin vs US Dollar', exchange: 'MT5', type: 'crypto' },
            { symbol: 'ETHUSD', full_name: 'ETHUSD', description: 'Ethereum vs US Dollar', exchange: 'MT5', type: 'crypto' },
            { symbol: 'XAUUSD', full_name: 'XAUUSD', description: 'Gold vs US Dollar', exchange: 'MT5', type: 'commodity' },
            { symbol: 'EURUSD', full_name: 'EURUSD', description: 'Euro vs US Dollar', exchange: 'MT5', type: 'forex' },
            { symbol: 'GBPUSD', full_name: 'GBPUSD', description: 'British Pound vs US Dollar', exchange: 'MT5', type: 'forex' },
            { symbol: 'USDJPY', full_name: 'USDJPY', description: 'US Dollar vs Japanese Yen', exchange: 'MT5', type: 'forex' },
        ];

        const filtered = symbols.filter(s => 
            s.symbol.toLowerCase().includes(userInput.toLowerCase()) ||
            s.description.toLowerCase().includes(userInput.toLowerCase())
        );

        onResult(filtered);
    }

    // REQUIRED: Called when the library needs to get symbol info
    resolveSymbol(symbolName, onResolve, onError) {
        console.log('[MT5Datafeed]: resolveSymbol', symbolName);

        // Determine symbol type and precision
        let symbolType = 'crypto';
        let pricescale = 100;
        
        if (symbolName.startsWith('BTC') || symbolName.startsWith('ETH')) {
            symbolType = 'crypto';
            pricescale = 100;
        } else if (symbolName.startsWith('XAU') || symbolName.startsWith('XAG')) {
            symbolType = 'commodity';
            pricescale = 100;
        } else if (symbolName.includes('USD') || symbolName.includes('EUR') || symbolName.includes('GBP') || symbolName.includes('JPY')) {
            symbolType = 'forex';
            pricescale = 10000;
        }

        const symbolInfo = {
            ticker: symbolName,
            name: symbolName,
            description: symbolName,
            type: symbolType,
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'MT5',
            minmov: 1,
            pricescale: pricescale,
            has_intraday: true,
            has_daily: true,
            has_weekly_and_monthly: true,
            supported_resolutions: ['1', '3', '5', '15', '30', '60', '120', '240', '360', '480', 'D', 'W', 'M'],
            volume_precision: 2,
            data_status: 'streaming',
        };

        console.log('[MT5Datafeed]: Resolved', symbolName, '-', symbolType);
        setTimeout(() => onResolve(symbolInfo), 0);
    }

    // Map TradingView resolution to MT5 timeframe (in minutes)
    getTimeframe(resolution) {
        const map = {
            '1': '1', '3': '3', '5': '5', '15': '15', '30': '30',
            '60': '60', '120': '120', '240': '240', '360': '360', '480': '480',
            'D': '1440', '1D': '1440',
            'W': '10080', '1W': '10080',
            'M': '43200', '1M': '43200'
        };
        return map[resolution] || '1';
    }

    // REQUIRED: Called when the library needs historical bars
    getBars(symbolInfo, resolution, periodParams, onResult, onError) {
        const { from, to, firstDataRequest } = periodParams;
        
        console.log('[MT5Datafeed]: getBars', symbolInfo.name, resolution, firstDataRequest ? '(first request)' : '(scrollback)');

        const timeframe = this.getTimeframe(resolution);
        // Fetch a lighter history on first load for reliability
        const count = firstDataRequest ? 100 : 500;
        
        const apiUrl = `${this.apiUrl}/chart/candle/history/${symbolInfo.name}?timeframe=${timeframe}&count=${count}`;
        console.log('[MT5Datafeed]: Fetching history:', symbolInfo.name, 'Timeframe:', timeframe, 'Count:', count);
        
        fetch(apiUrl, { cache: 'no-cache' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(async data => {
                console.log('[MT5Datafeed]: Received', data.length, 'candles');

                if (!Array.isArray(data) || data.length === 0) {
                    onResult([], { noData: true });
                    return;
                }

                // Transform MT5 data to TradingView format
                const bars = data
                    .map(candle => {
                        // Parse timestamp and align to candle open time
                        let timestamp = new Date(candle.time).getTime();
                        
                        // Align timestamp to the start of the timeframe period
                        const timeframeMs = parseInt(timeframe) * 60 * 1000;
                        timestamp = Math.floor(timestamp / timeframeMs) * timeframeMs;
                        
                        return {
                            time: timestamp,
                            open: parseFloat(candle.open),
                            high: parseFloat(candle.high),
                            low: parseFloat(candle.low),
                            close: parseFloat(candle.close),
                            volume: parseFloat(candle.volume || 0)
                        };
                    })
                    .filter(bar => !isNaN(bar.time) && !isNaN(bar.close))
                    .sort((a, b) => a.time - b.time);

                // Filter bars
                let finalBars;
                if (firstDataRequest) {
                    finalBars = bars.slice(-Math.min(100, bars.length));
                    console.log('[MT5Datafeed]: Returning', finalBars.length, 'historical bars');
                } else {
                    // Library may request a wide historical window we can't honor (API is count-based).
                    // Try to filter to requested range; if empty, fall back to the latest N bars we have.
                    const filtered = bars.filter(bar => bar.time >= from * 1000 && bar.time <= to * 1000);
                    finalBars = filtered.length > 0 ? filtered : bars.slice(-Math.min(100, bars.length));
                }

                // Fallback for minute-based resolutions when MT5 doesn't return fresh aggregated candles
                const tfInt = parseInt(timeframe);
                const nowMs = Date.now();
                const timeframeMs = tfInt * 60 * 1000;
                const newestTime = finalBars.length ? finalBars[finalBars.length - 1].time : 0;
                const needAggregation = (
                    Number.isFinite(tfInt) && tfInt > 1 &&
                    (finalBars.length === 0 || (nowMs - newestTime > timeframeMs * 2))
                );

                if (needAggregation) {
                    try {
                // Request just enough 1m bars to build ~100 aggregated bars with a small buffer
                const need1m = Math.min(tfInt * 105, 6000);
                const oneUrl = `${this.apiUrl}/chart/candle/history/${symbolInfo.name}?timeframe=1&count=${need1m}`;
                        const oneRes = await fetch(oneUrl, { cache: 'no-cache' });
                        if (oneRes.ok) {
                            const oneData = await oneRes.json();
                            const oneBars = oneData
                                .map(c => ({
                                    time: Math.floor(new Date(c.time).getTime() / (60 * 1000)) * 60 * 1000,
                                    open: parseFloat(c.open),
                                    high: parseFloat(c.high),
                                    low: parseFloat(c.low),
                                    close: parseFloat(c.close),
                                    volume: parseFloat(c.volume || 0)
                                }))
                                .filter(b => !isNaN(b.time) && !isNaN(b.close))
                                .sort((a,b) => a.time - b.time);

                            // Aggregate 1m -> tfInt minutes
                            const bucketMs = timeframeMs;
                            const aggMap = new Map();
                            for (const b of oneBars) {
                                const bucket = Math.floor(b.time / bucketMs) * bucketMs;
                                let a = aggMap.get(bucket);
                                if (!a) {
                                    a = { time: bucket, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
                                    aggMap.set(bucket, a);
                                } else {
                                    a.high = Math.max(a.high, b.high);
                                    a.low = Math.min(a.low, b.low);
                                    a.close = b.close;
                                    a.volume = (a.volume || 0) + (b.volume || 0);
                                }
                            }
                            const aggregated = Array.from(aggMap.values()).sort((a,b)=>a.time-b.time);
                            finalBars = aggregated.slice(-Math.min(100, aggregated.length));
                            console.log(`[MT5Datafeed]: Aggregated ${finalBars.length} bars from 1m for TF ${tfInt}`);
                        }
                    } catch (e) {
                        console.warn('[MT5Datafeed]: Aggregation fallback failed:', e?.message || e);
                    }
                }

                if (finalBars.length === 0) {
                    onResult([], { noData: true });
                } else {
                    onResult(finalBars, { noData: false });
                }
            })
            .catch(error => {
                console.error('[MT5Datafeed]: ❌ getBars error:', error);
                onError(error.message);
            });
    }

    // REQUIRED: Called when the library needs to subscribe to real-time updates
    subscribeBars(symbolInfo, resolution, onTick, listenerGuid, onResetCacheNeededCallback) {
        console.log('[MT5Datafeed]: subscribeBars', symbolInfo.name, resolution);

        const timeframe = this.getTimeframe(resolution);
        const tfInt = parseInt(timeframe);

        // If TF is 1 minute, use direct current endpoint for that TF.
        if (tfInt === 1) {
            const fetchCurrentCandle = async () => {
            try {
                const response = await fetch(`${this.apiUrl}/chart/candle/current/${symbolInfo.name}?timeframe=${timeframe}`, { cache: 'no-cache' });
                if (!response.ok) return;
                
                const candle = await response.json();
                
                // Parse and align timestamp to candle boundary
                let timestamp = new Date(candle.time).getTime();
                const timeframeMs = parseInt(timeframe) * 60 * 1000;
                timestamp = Math.floor(timestamp / timeframeMs) * timeframeMs;
                
                // Raw bar as returned by API (may not be cumulative)
                const bar = {
                    time: timestamp,
                    open: candle.open != null ? parseFloat(candle.open) : undefined,
                    high: candle.high != null ? parseFloat(candle.high) : undefined,
                    low: candle.low != null ? parseFloat(candle.low) : undefined,
                    close: parseFloat(candle.close),
                    volume: parseFloat(candle.volume || 0)
                };

                if (isNaN(bar.time) || isNaN(bar.close)) return;
                
                const fmt = (v) => Number.isFinite(v) ? v.toFixed(2) : '-';
                console.log('[MT5Datafeed]: Current candle OHLC -', 
                    'O:', fmt(bar.open),
                    'H:', fmt(bar.high),
                    'L:', fmt(bar.low),
                    'C:', fmt(bar.close));

                const lastBar = this.lastBars[listenerGuid];
                
                if (!lastBar) {
                    console.log('[MT5Datafeed]: Live updates started');
                    // For the first tick, if API does not provide O/H/L, seed them with close
                    const seeded = {
                        time: bar.time,
                        open: isFinite(bar.open) ? bar.open : bar.close,
                        high: isFinite(bar.high) ? bar.high : bar.close,
                        low:  isFinite(bar.low)  ? bar.low  : bar.close,
                        close: bar.close,
                        volume: bar.volume
                    };
                    this.lastBars[listenerGuid] = seeded;
                    onTick(seeded);
                    return;
                }
                
                // New candle
                if (bar.time > lastBar.time) {
                    console.log('[MT5Datafeed]: New candle -', new Date(bar.time));
                    // Start new candle; if API lacks full OHLC, initialize from close
                    const next = {
                        time: bar.time,
                        open: isFinite(bar.open) ? bar.open : bar.close,
                        high: isFinite(bar.high) ? bar.high : bar.close,
                        low:  isFinite(bar.low)  ? bar.low  : bar.close,
                        close: bar.close,
                        volume: bar.volume
                    };
                    this.lastBars[listenerGuid] = next;
                    onTick(next);
                } 
                // Update existing
                else if (bar.time === lastBar.time) {
                    // Accumulate OHLC if API doesn't
                    const open = isFinite(lastBar.open) ? lastBar.open : (isFinite(bar.open) ? bar.open : lastBar.close);
                    const highCandidates = [lastBar.high, bar.high, bar.close].filter(v => isFinite(v));
                    const lowCandidates = [lastBar.low, bar.low, bar.close].filter(v => isFinite(v));
                    const merged = {
                        time: lastBar.time,
                        open,
                        high: Math.max.apply(null, highCandidates),
                        low: Math.min.apply(null, lowCandidates),
                        close: bar.close,
                        volume: isFinite(bar.volume) ? Math.max(bar.volume, lastBar.volume || 0) : (lastBar.volume || 0)
                    };

                    const changed = (
                        merged.close !== lastBar.close ||
                        merged.high !== lastBar.high ||
                        merged.low !== lastBar.low ||
                        merged.volume !== lastBar.volume
                    );
                    if (changed) {
                        this.lastBars[listenerGuid] = merged;
                        onTick(merged);
                    }
                }
            } catch (error) {
                console.error('[MT5Datafeed]: Update error:', error.message);
            }
            };
            
            fetchCurrentCandle();
            const updateInterval = setInterval(fetchCurrentCandle, 1000);
            this.subscribers[listenerGuid] = updateInterval;
            return;
        }

        // Aggregated realtime for TF > 1 minute using 1m current candle
        const bucketMs = tfInt * 60 * 1000;
        this.aggregators[listenerGuid] = this.aggregators[listenerGuid] || null;

        const fetchAggFromOneMinute = async () => {
            try {
                const response = await fetch(`${this.apiUrl}/chart/candle/current/${symbolInfo.name}?timeframe=1`, { cache: 'no-cache' });
                if (!response.ok) return;
                const one = await response.json();

                // Align 1m candle open time
                const oneTime = Math.floor(new Date(one.time).getTime() / (60 * 1000)) * 60 * 1000;
                const bucketTime = Math.floor(oneTime / bucketMs) * bucketMs;

                // Normalize bar fields
                const oneBar = {
                    time: oneTime,
                    open: one.open != null ? parseFloat(one.open) : undefined,
                    high: one.high != null ? parseFloat(one.high) : undefined,
                    low: one.low != null ? parseFloat(one.low) : undefined,
                    close: parseFloat(one.close),
                    volume: parseFloat(one.volume || 0)
                };
                if (isNaN(oneBar.time) || isNaN(oneBar.close)) return;

                let agg = this.aggregators[listenerGuid];
                if (!agg || bucketTime > agg.time) {
                    // Start a new aggregated candle
                    agg = {
                        time: bucketTime,
                        open: isFinite(oneBar.open) ? oneBar.open : oneBar.close,
                        high: isFinite(oneBar.high) ? oneBar.high : oneBar.close,
                        low: isFinite(oneBar.low) ? oneBar.low : oneBar.close,
                        close: oneBar.close,
                        volume: isFinite(oneBar.volume) ? oneBar.volume : 0,
                        _sumPrev: 0,
                        _currMinTime: oneBar.time,
                        _prevMinVol: isFinite(oneBar.volume) ? oneBar.volume : 0
                    };
                    this.aggregators[listenerGuid] = agg;
                    // Hint the library that cache may need to refresh when a new candle starts
                    if (typeof onResetCacheNeededCallback === 'function') {
                        try { onResetCacheNeededCallback(); } catch (_) {}
                    }
                    this.lastBars[listenerGuid] = { ...agg };
                    onTick({ ...agg });
                    return;
                }

                // Same bucket: extend aggregated candle
                agg.high = Math.max(agg.high, isFinite(oneBar.high) ? oneBar.high : oneBar.close, oneBar.close);
                agg.low = Math.min(agg.low, isFinite(oneBar.low) ? oneBar.low : oneBar.close, oneBar.close);
                agg.close = oneBar.close;

                // Volume accumulation across minutes without double counting
                if (agg._currMinTime === oneBar.time) {
                    agg._prevMinVol = isFinite(oneBar.volume) ? oneBar.volume : agg._prevMinVol;
                } else {
                    // minute rolled
                    agg._sumPrev += agg._prevMinVol;
                    agg._currMinTime = oneBar.time;
                    agg._prevMinVol = isFinite(oneBar.volume) ? oneBar.volume : 0;
                }
                agg.volume = agg._sumPrev + agg._prevMinVol;

                // Always push the latest state so higher TFs visibly move like 1m
                this.lastBars[listenerGuid] = { ...agg };
                onTick({ ...agg });
            } catch (error) {
                console.error('[MT5Datafeed]: Aggregated update error:', error.message);
            }
        };

        fetchAggFromOneMinute();
        const interval = setInterval(fetchAggFromOneMinute, 1000);
        this.subscribers[listenerGuid] = interval;
    }

    // REQUIRED: Called when the library needs to unsubscribe from real-time updates
    unsubscribeBars(listenerGuid) {
        console.log('[MT5Datafeed]: unsubscribeBars', listenerGuid);

        if (this.subscribers[listenerGuid]) {
            clearInterval(this.subscribers[listenerGuid]);
            delete this.subscribers[listenerGuid];
            delete this.lastBars[listenerGuid];
            if (this.aggregators[listenerGuid]) {
                delete this.aggregators[listenerGuid];
            }
        }
    }

    // OPTIONAL: Get server time
    getServerTime(callback) {
        fetch(`${this.apiUrl}/time`)
            .then(response => response.json())
            .then(data => {
                const serverTime = Math.floor(new Date(data.serverTime).getTime() / 1000);
                callback(serverTime);
            })
            .catch(() => {
                // Fallback to local time
                callback(Math.floor(Date.now() / 1000));
            });
    }
}

// Export for use in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MT5Datafeed;
}
