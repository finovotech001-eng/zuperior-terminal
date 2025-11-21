/**
 * Custom Datafeed for MetaAPI
 * Implements TradingView Advanced Charts Datafeed API
 */

class MetaAPIDatafeed {
    constructor(baseUrl = 'https://metaapi.zuperior.com') {
        this.baseUrl = baseUrl;
        this.subscribers = new Map();
        this.updateInterval = null;
        this.currentSymbol = null;
        this.currentResolution = null;
    }

    /**
     * IExternalDatafeed implementation
     */
    onReady(callback) {
        setTimeout(() => {
            callback({
                supports_search: true,
                supports_group_request: false,
                supports_marks: false,
                supports_timescale_marks: false,
                supports_time: false,
                supported_resolutions: ['1', '5', '15', '30', '60', '1D'],
                supports_quotes: false
            });
        }, 0);
    }

    /**
     * IDatafeedChartApi implementation
     */
    searchSymbols(userInput, exchange, symbolType, onResult) {
        // For now, return a simple result with the input as symbol
        // You can enhance this to call your API's search endpoint if available
        const result = [{
            symbol: userInput.toUpperCase(),
            full_name: userInput.toUpperCase(),
            description: userInput.toUpperCase(),
            exchange: 'Crypto',
            ticker: userInput.toUpperCase(),
            type: 'crypto'
        }];
        onResult(result);
    }

    resolveSymbol(symbolName, onResolve, onError) {
        // Return symbol info
        const symbolInfo = {
            name: symbolName.toUpperCase(),
            ticker: symbolName.toUpperCase(),
            description: symbolName.toUpperCase(),
            type: 'crypto',
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: 'Crypto',
            minmov: 1,
            pricescale: 100, // Adjust based on your symbol
            has_intraday: true,
            has_daily: true,
            has_weekly_and_monthly: true,
            supported_resolutions: ['1', '5', '15', '30', '60', '1D'],
            intraday_multipliers: ['1', '5', '15', '30', '60'],
            volume_precision: 0,
            data_status: 'streaming'
        };
        onResolve(symbolInfo);
    }

    getBars(symbolInfo, resolution, periodParams, onResult, onError) {
        const symbol = symbolInfo.ticker || symbolInfo.name;
        const timeframe = this._convertResolutionToTimeframe(resolution);
        
        // Calculate count based on time range
        // periodParams.from and periodParams.to are in seconds (Unix timestamp)
        const timeRangeSeconds = periodParams.to - periodParams.from;
        const timeframeSeconds = timeframe * 60;
        const count = Math.ceil(timeRangeSeconds / timeframeSeconds);
        
        // Request more bars than needed to ensure we have enough, but limit to 1000
        const requestCount = Math.min(Math.max(count, 100), 1000);
        
        // Build URL
        const url = `${this.baseUrl}/api/Chart/candle/history/${symbol}?timeframe=${timeframe}&count=${requestCount}`;
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    // Convert candles to bars
                    let bars = this._convertCandlesToBars(data);
                    
                    // Filter bars by time range (from/to are in seconds, bars.time is in milliseconds)
                    const fromMillis = periodParams.from * 1000;
                    const toMillis = periodParams.to * 1000;
                    
                    bars = bars.filter(bar => bar.time >= fromMillis && bar.time <= toMillis);
                    
                    // Sort by time ascending
                    bars.sort((a, b) => a.time - b.time);
                    
                    const meta = {
                        noData: bars.length === 0
                    };
                    
                    onResult(bars, meta);
                } else {
                    onResult([], { noData: true });
                }
            })
            .catch(error => {
                console.error('Error fetching historical data:', error);
                onError(error.message || 'Failed to fetch historical data');
            });
    }

    subscribeBars(symbolInfo, resolution, onTick, listenerGuid, onResetCacheNeededCallback) {
        const symbol = symbolInfo.ticker || symbolInfo.name;
        this.currentSymbol = symbol;
        this.currentResolution = resolution;
        
        // Store subscriber
        this.subscribers.set(listenerGuid, {
            symbol: symbol,
            resolution: resolution,
            onTick: onTick,
            onResetCacheNeededCallback: onResetCacheNeededCallback
        });

        // Start polling for updates
        this._startPolling();
    }

    unsubscribeBars(listenerGuid) {
        this.subscribers.delete(listenerGuid);
        if (this.subscribers.size === 0) {
            this._stopPolling();
        }
    }

    /**
     * Helper methods
     */
    _convertResolutionToTimeframe(resolution) {
        // Convert TradingView resolution to MetaAPI timeframe (in minutes)
        if (resolution === '1D') return 1440; // 1 day = 1440 minutes
        if (resolution === '1W') return 10080; // 1 week = 10080 minutes
        if (resolution === '1M') return 43200; // 1 month = 43200 minutes (approx)
        
        // For intraday, resolution is already in minutes
        const minutes = parseInt(resolution);
        return isNaN(minutes) ? 1 : minutes;
    }

    _convertCandlesToBars(candles) {
        return candles.map(candle => {
            // Handle ISO string or timestamp
            let timeMillis;
            if (typeof candle.time === 'string') {
                timeMillis = new Date(candle.time).getTime();
            } else if (typeof candle.time === 'number') {
                // If already a timestamp, check if it's seconds or milliseconds
                timeMillis = candle.time < 1e12 ? candle.time * 1000 : candle.time;
            } else {
                console.warn('Unknown time format:', candle.time);
                timeMillis = Date.now();
            }
            
            return {
                time: timeMillis,
                open: parseFloat(candle.open) || 0,
                high: parseFloat(candle.high) || 0,
                low: parseFloat(candle.low) || 0,
                close: parseFloat(candle.close) || 0,
                volume: parseFloat(candle.volume) || 0
            };
        });
    }

    _startPolling() {
        if (this.updateInterval) return; // Already polling

        this.updateInterval = setInterval(() => {
            if (this.subscribers.size === 0) {
                this._stopPolling();
                return;
            }

            // Poll each subscriber
            this.subscribers.forEach((subscriber, guid) => {
                const timeframe = this._convertResolutionToTimeframe(subscriber.resolution);
                const url = `${this.baseUrl}/api/chart/candle/current/${subscriber.symbol}?timeframe=${timeframe}`;
                
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.time) {
                            // Handle ISO string or timestamp
                            let timeMillis;
                            if (typeof data.time === 'string') {
                                timeMillis = new Date(data.time).getTime();
                            } else if (typeof data.time === 'number') {
                                timeMillis = data.time < 1e12 ? data.time * 1000 : data.time;
                            } else {
                                return; // Skip invalid data
                            }
                            
                            const bar = {
                                time: timeMillis,
                                open: parseFloat(data.open) || 0,
                                high: parseFloat(data.high) || 0,
                                low: parseFloat(data.low) || 0,
                                close: parseFloat(data.close) || 0,
                                volume: parseFloat(data.volume) || 0
                            };
                            subscriber.onTick(bar);
                        }
                    })
                    .catch(error => {
                        console.error('Error fetching current candle:', error);
                    });
            });
        }, 5000); // Poll every 5 seconds
    }

    _stopPolling() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

// Export for use in browser
if (typeof window !== 'undefined') {
    window.MetaAPIDatafeed = MetaAPIDatafeed;
}

