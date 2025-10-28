/**
 * MT5 Datafeed for TradingView Charts
 * Connects to MT5 API at http://18.130.5.209:5003 for real-time chart data
 */

interface DatafeedConfiguration {
  supported_resolutions: string[];
  supports_group_request: boolean;
  supports_marks: boolean;
  supports_search: boolean;
  supports_time: boolean;
  supports_timescale_marks: boolean;
}

interface SymbolInfo {
  name: string;
  ticker: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  supported_resolutions: string[];
  volume_precision: number;
  data_status: string;
  full_name: string;
}

interface Bar {
  time: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
}

interface HistoryCallback {
  (bars: Bar[] | null): void;
}

type BarsCallback = (bars: Bar[]) => void;
type ErrorCallback = (reason: string) => void;

interface MT5Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * MT5 Datafeed implementation for TradingView
 */
export class MT5Datafeed {
  private baseUrl = '/apis/chart/proxy';
  private mt5ApiUrl = 'http://18.130.5.209:5003';
  private subscriptions = new Map<string, NodeJS.Timeout>();
  private lastBarCache = new Map<string, Bar>();

  /**
   * Initializes the datafeed
   */
  onReady(callback: (configuration: DatafeedConfiguration) => void): void {
    setTimeout(() => {
      callback({
        supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
        supports_group_request: false,
        supports_marks: false,
        supports_search: true,
        supports_time: true,
        supports_timescale_marks: false,
      });
    }, 0);
  }

  /**
   * Resolves symbol information
   */
  resolveSymbol(
    symbolName: string,
    onSymbolResolvedCallback: (symbolInfo: SymbolInfo) => void,
    onResolveErrorCallback: (reason: string) => void
  ): void {
    try {
      // Normalize symbol (remove slashes, convert to uppercase)
      const normalizedSymbol = symbolName.toUpperCase().replace(/\//g, '');
      
      // Map to common symbols
      const symbolMap: Record<string, SymbolInfo> = {
        'EURUSD': {
          name: 'EURUSD',
          ticker: 'EURUSD',
          description: 'Euro vs US Dollar',
          type: 'forex',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'FOREX',
          minmov: 1,
          pricescale: 100000,
          has_intraday: true,
          supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
          volume_precision: 2,
          data_status: 'streaming',
          full_name: 'EURUSD',
        },
        'GBPUSD': {
          name: 'GBPUSD',
          ticker: 'GBPUSD',
          description: 'British Pound vs US Dollar',
          type: 'forex',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'FOREX',
          minmov: 1,
          pricescale: 100000,
          has_intraday: true,
          supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
          volume_precision: 2,
          data_status: 'streaming',
          full_name: 'GBPUSD',
        },
        'USDJPY': {
          name: 'USDJPY',
          ticker: 'USDJPY',
          description: 'US Dollar vs Japanese Yen',
          type: 'forex',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'FOREX',
          minmov: 1,
          pricescale: 1000,
          has_intraday: true,
          supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
          volume_precision: 2,
          data_status: 'streaming',
          full_name: 'USDJPY',
        },
        'XAUUSD': {
          name: 'XAUUSD',
          ticker: 'XAUUSD',
          description: 'Gold vs US Dollar',
          type: 'metal',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'FOREX',
          minmov: 1,
          pricescale: 100,
          has_intraday: true,
          supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
          volume_precision: 2,
          data_status: 'streaming',
          full_name: 'XAUUSD',
        },
        'XAGUSD': {
          name: 'XAGUSD',
          ticker: 'XAGUSD',
          description: 'Silver vs US Dollar',
          type: 'metal',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'FOREX',
          minmov: 1,
          pricescale: 1000,
          has_intraday: true,
          supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
          volume_precision: 2,
          data_status: 'streaming',
          full_name: 'XAGUSD',
        },
        'BTCUSD': {
          name: 'BTCUSD',
          ticker: 'BTCUSD',
          description: 'Bitcoin vs US Dollar',
          type: 'crypto',
          session: '24x7',
          timezone: 'Etc/UTC',
          exchange: 'CRYPTO',
          minmov: 1,
          pricescale: 100,
          has_intraday: true,
          supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
          volume_precision: 2,
          data_status: 'streaming',
          full_name: 'BTCUSD',
        },
      };

      const symbolInfo = symbolMap[normalizedSymbol] || {
        name: normalizedSymbol,
        ticker: normalizedSymbol,
        description: normalizedSymbol,
        type: 'forex',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'FOREX',
        minmov: 1,
        pricescale: 100000,
        has_intraday: true,
        supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
        volume_precision: 2,
        data_status: 'streaming',
        full_name: normalizedSymbol,
      };

      onSymbolResolvedCallback(symbolInfo);
    } catch (error) {
      onResolveErrorCallback((error as Error).message);
    }
  }

  /**
   * Searches for symbols
   */
  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReadyCallback: (symbols: SymbolInfo[]) => void
  ): void {
    const symbols: SymbolInfo[] = [
      { name: 'EURUSD', ticker: 'EURUSD', description: 'Euro vs US Dollar', type: 'forex', session: '24x7', timezone: 'Etc/UTC', exchange: 'FOREX', minmov: 1, pricescale: 100000, has_intraday: true, supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'], volume_precision: 2, data_status: 'streaming', full_name: 'EURUSD' },
      { name: 'GBPUSD', ticker: 'GBPUSD', description: 'British Pound vs US Dollar', type: 'forex', session: '24x7', timezone: 'Etc/UTC', exchange: 'FOREX', minmov: 1, pricescale: 100000, has_intraday: true, supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'], volume_precision: 2, data_status: 'streaming', full_name: 'GBPUSD' },
      { name: 'XAUUSD', ticker: 'XAUUSD', description: 'Gold vs US Dollar', type: 'metal', session: '24x7', timezone: 'Etc/UTC', exchange: 'FOREX', minmov: 1, pricescale: 100, has_intraday: true, supported_resolutions: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'], volume_precision: 2, data_status: 'streaming', full_name: 'XAUUSD' },
    ];

    const filtered = symbols.filter(s => 
      s.name.toLowerCase().includes(userInput.toLowerCase()) || 
      s.description.toLowerCase().includes(userInput.toLowerCase())
    );

    onResultReadyCallback(filtered);
  }

  /**
   * Fetches historical bars
   */
  async getBars(
    symbolInfo: SymbolInfo,
    resolution: string,
    periodParams: {
      from: number;
      to: number;
      firstDataRequest: boolean;
    },
    onHistoryCallback: HistoryCallback,
    onErrorCallback: ErrorCallback
  ): Promise<void> {
    try {
      // Convert timeframe resolution to MT5 format
      const timeframe = this.convertResolutionToTimeframe(resolution);
      
      // Calculate how many bars we need
      const barCount = Math.ceil((periodParams.to - periodParams.from) / this.getBarDuration(resolution)) || 300;
      
      const symbol = symbolInfo.ticker;
      const url = `${this.baseUrl}?symbol=${symbol}&timeframe=${timeframe}&count=${Math.min(barCount, 500)}`;
      
      console.log('[MT5 Datafeed] Fetching bars:', { symbol, resolution, timeframe, barCount, url });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: MT5Candle[] = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        onHistoryCallback([]);
        return;
      }

      // Transform MT5 candles to TradingView bars
      const bars: Bar[] = data.map(candle => ({
        time: new Date(candle.time).getTime(),
        low: candle.low,
        high: candle.high,
        open: candle.open,
        close: candle.close,
        volume: candle.volume,
      }));

      console.log('[MT5 Datafeed] Fetched', bars.length, 'bars for', symbol);
      
      // Cache the last bar for real-time updates
      if (bars.length > 0) {
        this.lastBarCache.set(`${symbol}-${resolution}`, bars[bars.length - 1]);
      }

      onHistoryCallback(bars);
    } catch (error) {
      console.error('[MT5 Datafeed] Error fetching bars:', error);
      onErrorCallback((error as Error).message);
    }
  }

  /**
   * Subscribes to real-time bar updates
   */
  subscribeBars(
    symbolInfo: SymbolInfo,
    resolution: string,
    onTick: BarsCallback,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void
  ): void {
    console.log('[MT5 Datafeed] Subscribing to real-time updates:', { symbol: symbolInfo.ticker, resolution });
    
    const symbol = symbolInfo.ticker;
    const key = `${symbol}-${resolution}`;
    
    // Clear existing subscription for this symbol
    this.unsubscribeBars(subscriberUID);

    // Poll for updates every 1-2 seconds
    const interval = setInterval(async () => {
      try {
        const timeframe = this.convertResolutionToTimeframe(resolution);
        const url = `${this.baseUrl}?symbol=${symbol}&timeframe=${timeframe}&count=2`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          return;
        }

        const data: MT5Candle[] = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
          return;
        }

        // Get the latest candle
        const latestCandle = data[data.length - 1];
        const latestBar: Bar = {
          time: new Date(latestCandle.time).getTime(),
          low: latestCandle.low,
          high: latestCandle.high,
          open: latestCandle.open,
          close: latestCandle.close,
          volume: latestCandle.volume,
        };

        const lastCachedBar = this.lastBarCache.get(key);
        
        // Check if this is a new bar or an update to the current bar
        if (lastCachedBar && latestBar.time === lastCachedBar.time) {
          // Update existing bar
          onTick([latestBar]);
        } else if (!lastCachedBar || latestBar.time > lastCachedBar.time) {
          // New bar - need to reset chart
          this.lastBarCache.set(key, latestBar);
          onResetCacheNeededCallback();
        }
      } catch (error) {
        console.error('[MT5 Datafeed] Error in polling:', error);
      }
    }, 2000); // Poll every 2 seconds

    this.subscriptions.set(subscriberUID, interval);
  }

  /**
   * Unsubscribes from real-time updates
   */
  unsubscribeBars(subscriberUID: string): void {
    const interval = this.subscriptions.get(subscriberUID);
    if (interval) {
      clearInterval(interval);
      this.subscriptions.delete(subscriberUID);
      console.log('[MT5 Datafeed] Unsubscribed from updates:', subscriberUID);
    }
  }

  /**
   * Converts TradingView resolution to MT5 timeframe
   */
  private convertResolutionToTimeframe(resolution: string): number {
    const resolutionMap: Record<string, number> = {
      '1': 1,      // 1 minute
      '5': 5,      // 5 minutes
      '15': 15,    // 15 minutes
      '30': 30,    // 30 minutes
      '60': 60,    // 1 hour
      '240': 240,  // 4 hours
      'D': 1440,   // 1 day
      'W': 10080,  // 1 week
      'M': 43200,  // 1 month
    };

    return resolutionMap[resolution] || 1;
  }

  /**
   * Gets the duration of a bar in milliseconds
   */
  private getBarDuration(resolution: string): number {
    const durationMap: Record<string, number> = {
      '1': 60 * 1000,        // 1 minute
      '5': 5 * 60 * 1000,    // 5 minutes
      '15': 15 * 60 * 1000,  // 15 minutes
      '30': 30 * 60 * 1000,   // 30 minutes
      '60': 60 * 60 * 1000,  // 1 hour
      '240': 4 * 60 * 60 * 1000,  // 4 hours
      'D': 24 * 60 * 60 * 1000,   // 1 day
      'W': 7 * 24 * 60 * 60 * 1000,  // 1 week
      'M': 30 * 24 * 60 * 60 * 1000, // 1 month
    };

    return durationMap[resolution] || 60 * 1000;
  }
}

