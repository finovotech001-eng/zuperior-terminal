// SignalR-based TradingView Datafeed with HTTP fallback
class SignalRDatafeed {
    constructor(wsBaseUrl = 'http://localhost:3000', httpFallback = null) {
        this.wsUrl = wsBaseUrl;
        this.httpFallback = httpFallback;
        this.connection = null;
        this.subscribers = {};
        this.lastBars = {};
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.initSignalR();
    }

    async initSignalR() {
        try {
            this.connection = new signalR.HubConnectionBuilder()
                .withUrl(`${this.wsUrl}/hubs/chart`)
                .withAutomaticReconnect()
                .build();

            this.connection.on('CandleUpdate', (data) => {
                this.handleCandleUpdate(data);
            });

            this.connection.onreconnecting(() => {
                console.log('[SignalR]: Reconnecting...');
                this.isConnected = false;
            });

            this.connection.onreconnected(() => {
                console.log('[SignalR]: Reconnected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
            });

            this.connection.onclose(() => {
                console.log('[SignalR]: Connection closed');
                this.isConnected = false;
            });

            await this.connection.start();
            this.isConnected = true;
            console.log('[SignalR]: Connected successfully');
        } catch (error) {
            console.error('[SignalR]: Connection failed:', error);
            this.isConnected = false;
        }
    }

    handleCandleUpdate(data) {
        // Handle real-time candle updates from SignalR
        Object.keys(this.subscribers).forEach(guid => {
            const subscriber = this.subscribers[guid];
            if (subscriber && subscriber.symbolInfo.name === data.symbol) {
                const bar = {
                    time: new Date(data.time).getTime(),
                    open: parseFloat(data.open),
                    high: parseFloat(data.high),
                    low: parseFloat(data.low),
                    close: parseFloat(data.close),
                    volume: parseFloat(data.volume || 0)
                };
                
                this.lastBars[guid] = bar;
                subscriber.onTick(bar);
            }
        });
    }

    // Delegate to HTTP fallback for configuration
    onReady(callback) {
        if (this.httpFallback) {
            return this.httpFallback.onReady(callback);
        }
        
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

    searchSymbols(userInput, exchange, symbolType, onResult) {
        if (this.httpFallback) {
            return this.httpFallback.searchSymbols(userInput, exchange, symbolType, onResult);
        }
        
        // Fallback symbol list
        const symbols = [
            { symbol: 'BTCUSD', full_name: 'BTCUSD', description: 'Bitcoin vs US Dollar', exchange: 'MT5', type: 'crypto' },
            { symbol: 'ETHUSD', full_name: 'ETHUSD', description: 'Ethereum vs US Dollar', exchange: 'MT5', type: 'crypto' },
            { symbol: 'XAUUSD', full_name: 'XAUUSD', description: 'Gold vs US Dollar', exchange: 'MT5', type: 'commodity' },
            { symbol: 'EURUSD', full_name: 'EURUSD', description: 'Euro vs US Dollar', exchange: 'MT5', type: 'forex' },
        ];
        
        const filtered = symbols.filter(s => 
            s.symbol.toLowerCase().includes(userInput.toLowerCase()) ||
            s.description.toLowerCase().includes(userInput.toLowerCase())
        );
        
        onResult(filtered);
    }

    resolveSymbol(symbolName, onResolve, onError) {
        if (this.httpFallback) {
            return this.httpFallback.resolveSymbol(symbolName, onResolve, onError);
        }
        
        // Fallback symbol resolution
        let symbolType = 'crypto';
        let pricescale = 100;
        
        if (symbolName.includes('USD') || symbolName.includes('EUR') || symbolName.includes('GBP') || symbolName.includes('JPY')) {
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
        
        setTimeout(() => onResolve(symbolInfo), 0);
    }

    getBars(symbolInfo, resolution, periodParams, onResult, onError) {
        // Always use HTTP fallback for historical data
        if (this.httpFallback) {
            return this.httpFallback.getBars(symbolInfo, resolution, periodParams, onResult, onError);
        }
        
        // If no fallback, return empty data
        onResult([], { noData: true });
    }

    subscribeBars(symbolInfo, resolution, onTick, listenerGuid, onResetCacheNeededCallback) {
        console.log('[SignalR]: subscribeBars', symbolInfo.name, resolution);
        
        this.subscribers[listenerGuid] = {
            symbolInfo,
            resolution,
            onTick,
            onResetCacheNeededCallback
        };

        // If SignalR is connected, subscribe to real-time updates
        if (this.isConnected && this.connection) {
            this.connection.invoke('SubscribeToSymbol', symbolInfo.name, resolution)
                .catch(err => console.error('[SignalR]: Subscribe error:', err));
        }

        // Also use HTTP fallback for real-time updates as backup
        if (this.httpFallback) {
            this.httpFallback.subscribeBars(symbolInfo, resolution, onTick, listenerGuid, onResetCacheNeededCallback);
        }
    }

    unsubscribeBars(listenerGuid) {
        console.log('[SignalR]: unsubscribeBars', listenerGuid);
        
        const subscriber = this.subscribers[listenerGuid];
        if (subscriber && this.isConnected && this.connection) {
            this.connection.invoke('UnsubscribeFromSymbol', subscriber.symbolInfo.name, subscriber.resolution)
                .catch(err => console.error('[SignalR]: Unsubscribe error:', err));
        }
        
        delete this.subscribers[listenerGuid];
        delete this.lastBars[listenerGuid];

        // Also unsubscribe from HTTP fallback
        if (this.httpFallback) {
            this.httpFallback.unsubscribeBars(listenerGuid);
        }
    }

    getServerTime(callback) {
        if (this.httpFallback) {
            return this.httpFallback.getServerTime(callback);
        }
        
        // Fallback to local time
        callback(Math.floor(Date.now() / 1000));
    }
}

// Export for browser usage
if (typeof window !== 'undefined') {
    window.SignalRDatafeed = SignalRDatafeed;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SignalRDatafeed;
}