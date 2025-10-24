/**
 * WebSocket Service for Real-Time Market Data
 * Uses SignalR to connect to MT5 Live Data Hubs
 */

import * as signalR from '@microsoft/signalr'

// WebSocket Hub URLs
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://18.130.5.209:5003'
const LIVE_DATA_HUB = `${BASE_URL}/hubs/livedata`
const CHART_HUB = `${BASE_URL}/hubs/chart`
const TRADING_HUB = `${BASE_URL}/hubs/mobiletrading`

// Types
export interface TickData {
  symbol: string
  bid: number
  ask: number
  spread: number
  timestamp: number
  change?: number
  changePercent?: number
}

export interface CandleData {
  symbol: string
  timeframe: string
  candle: {
    time: number
    open: number
    high: number
    low: number
    close: number
    volume: number
  }
}

export interface TradeEvent {
  orderId: string
  symbol: string
  type: 'buy' | 'sell'
  volume: number
  price: number
  status: 'pending' | 'filled' | 'rejected'
  timestamp: number
}

// Event callback types
type TickCallback = (tick: TickData) => void
type CandleCallback = (candle: CandleData) => void
type TradeCallback = (trade: TradeEvent) => void

/**
 * WebSocket Manager Class
 */
class WebSocketManager {
  private liveDataConnection: signalR.HubConnection | null = null
  private chartConnection: signalR.HubConnection | null = null
  private tradingConnection: signalR.HubConnection | null = null
  
  private tickSubscribers: Map<string, Set<TickCallback>> = new Map()
  private candleSubscribers: Map<string, Set<CandleCallback>> = new Map()
  private tradeSubscribers: Set<TradeCallback> = new Set()
  
  private jwtToken: string | null = null
  private isConnecting = false
  private isDisconnecting = false

  /**
   * Set JWT token for authentication
   */
  setToken(token: string) {
    this.jwtToken = token
  }

  /**
   * Get JWT token (from localStorage or cookie)
   */
  private getToken(): string | null {
    if (this.jwtToken) return this.jwtToken
    
    // Try to get from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token') || null
    }
    
    return null
  }

  /**
   * Connect to Live Data Hub (for tick prices)
   */
  async connectLiveData(): Promise<void> {
    // Check if already connected or disconnecting
    if (this.liveDataConnection?.state === signalR.HubConnectionState.Connected) {
      console.log('✅ Live Data Hub already connected')
      return
    }

    if (this.isConnecting || this.isDisconnecting) {
      console.log('⏳ Connection already in progress or disconnecting...')
      return
    }

    this.isConnecting = true

    try {
      const token = this.getToken()
      
      console.log(`🔌 Attempting to connect to: ${LIVE_DATA_HUB}`)
      
      this.liveDataConnection = new signalR.HubConnectionBuilder()
        .withUrl(LIVE_DATA_HUB, {
          accessTokenFactory: () => token || '',
          skipNegotiation: true, // Skip negotiation and use WebSocket directly
          transport: signalR.HttpTransportType.WebSockets,
          withCredentials: false, // Don't send credentials for CORS
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            console.log(`⏳ Reconnect attempt ${retryContext.previousRetryCount + 1}`)
            return 5000 // Retry every 5 seconds
          }
        })
        .configureLogging(signalR.LogLevel.Warning) // Reduce noise, only show warnings and errors
        .build()

      // Register event handlers
      this.liveDataConnection.on('TickUpdate', (tick: TickData) => {
        this.handleTickUpdate(tick)
      })

      this.liveDataConnection.onreconnecting(() => {
        console.log('🔄 Reconnecting to Live Data Hub...')
      })

      this.liveDataConnection.onreconnected(() => {
        console.log('✅ Reconnected to Live Data Hub')
        this.resubscribeToSymbols()
      })

      this.liveDataConnection.onclose(() => {
        console.log('❌ Live Data Hub connection closed')
      })

      // Only start if not disconnecting
      if (!this.isDisconnecting) {
        await this.liveDataConnection.start()
        console.log('✅ Connected to Live Data Hub')
      }
    } catch (error) {
      // Only log if it's not due to disconnecting
      if (!this.isDisconnecting) {
        console.warn('⚠️ Live Data Hub connection failed (server may be offline):', error instanceof Error ? error.message : 'Unknown error')
      }
      // Don't throw - allow app to continue without WebSocket
      this.liveDataConnection = null
    } finally {
      this.isConnecting = false
    }
  }

  /**
   * Connect to Chart Hub (for candle updates)
   */
  async connectChart(): Promise<void> {
    // Check if already connected or disconnecting
    if (this.chartConnection?.state === signalR.HubConnectionState.Connected) {
      console.log('✅ Chart Hub already connected')
      return
    }

    if (this.isConnecting || this.isDisconnecting) {
      console.log('⏳ Connection already in progress or disconnecting...')
      return
    }

    try {
      const token = this.getToken()
      
      console.log(`🔌 Attempting to connect to: ${CHART_HUB}`)
      
      this.chartConnection = new signalR.HubConnectionBuilder()
        .withUrl(CHART_HUB, {
          accessTokenFactory: () => token || '',
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets,
          withCredentials: false,
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: () => 5000
        })
        .configureLogging(signalR.LogLevel.Warning)
        .build()

      // Register event handlers
      this.chartConnection.on('CandleUpdate', (candle: CandleData) => {
        this.handleCandleUpdate(candle)
      })

      // Only start if not disconnecting
      if (!this.isDisconnecting) {
        await this.chartConnection.start()
        console.log('✅ Connected to Chart Hub')
      }
    } catch (error) {
      // Only log if it's not due to disconnecting
      if (!this.isDisconnecting) {
        console.warn('⚠️ Chart Hub connection failed (server may be offline):', error instanceof Error ? error.message : 'Unknown error')
      }
      this.chartConnection = null
    }
  }

  /**
   * Connect to Trading Hub (for trade events)
   */
  async connectTrading(): Promise<void> {
    // Check if already connected or disconnecting
    if (this.tradingConnection?.state === signalR.HubConnectionState.Connected) {
      console.log('✅ Trading Hub already connected')
      return
    }

    if (this.isConnecting || this.isDisconnecting) {
      console.log('⏳ Connection already in progress or disconnecting...')
      return
    }

    try {
      const token = this.getToken()
      
      console.log(`🔌 Attempting to connect to: ${TRADING_HUB}`)
      
      this.tradingConnection = new signalR.HubConnectionBuilder()
        .withUrl(TRADING_HUB, {
          accessTokenFactory: () => token || '',
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets,
          withCredentials: false,
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: () => 5000
        })
        .configureLogging(signalR.LogLevel.Warning)
        .build()

      // Register event handlers
      this.tradingConnection.on('TradeUpdate', (trade: TradeEvent) => {
        this.handleTradeUpdate(trade)
      })

      // Only start if not disconnecting
      if (!this.isDisconnecting) {
        await this.tradingConnection.start()
        console.log('✅ Connected to Trading Hub')
      }
    } catch (error) {
      // Only log if it's not due to disconnecting
      if (!this.isDisconnecting) {
        console.warn('⚠️ Trading Hub connection failed (server may be offline):', error instanceof Error ? error.message : 'Unknown error')
      }
      this.tradingConnection = null
    }
  }

  /**
   * Subscribe to tick updates for a symbol
   */
  async subscribeToTicks(symbol: string, callback: TickCallback): Promise<void> {
    // Add callback to subscribers
    if (!this.tickSubscribers.has(symbol)) {
      this.tickSubscribers.set(symbol, new Set())
    }
    this.tickSubscribers.get(symbol)!.add(callback)

    // Subscribe on server if connected
    if (this.liveDataConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.liveDataConnection.invoke('SubscribeToSymbol', symbol)
        console.log(`✅ Subscribed to ${symbol}`)
      } catch (error) {
        console.error(`❌ Failed to subscribe to ${symbol}:`, error)
      }
    }
  }

  /**
   * Unsubscribe from tick updates for a symbol
   */
  async unsubscribeFromTicks(symbol: string, callback: TickCallback): Promise<void> {
    const subscribers = this.tickSubscribers.get(symbol)
    if (subscribers) {
      subscribers.delete(callback)
      
      // If no more subscribers, unsubscribe from server
      if (subscribers.size === 0) {
        this.tickSubscribers.delete(symbol)
        
        if (this.liveDataConnection?.state === signalR.HubConnectionState.Connected) {
          try {
            await this.liveDataConnection.invoke('UnsubscribeFromSymbol', symbol)
            console.log(`✅ Unsubscribed from ${symbol}`)
          } catch (error) {
            console.error(`❌ Failed to unsubscribe from ${symbol}:`, error)
          }
        }
      }
    }
  }

  /**
   * Subscribe to candle updates for a symbol
   */
  async subscribeToCandles(symbol: string, timeframe: string, callback: CandleCallback): Promise<void> {
    const key = `${symbol}:${timeframe}`
    
    if (!this.candleSubscribers.has(key)) {
      this.candleSubscribers.set(key, new Set())
    }
    this.candleSubscribers.get(key)!.add(callback)

    if (this.chartConnection?.state === signalR.HubConnectionState.Connected) {
      try {
        await this.chartConnection.invoke('SubscribeToCandles', symbol, timeframe)
        console.log(`✅ Subscribed to ${symbol} ${timeframe} candles`)
      } catch (error) {
        console.error(`❌ Failed to subscribe to candles:`, error)
      }
    }
  }

  /**
   * Subscribe to trade events
   */
  subscribeToTrades(callback: TradeCallback): void {
    this.tradeSubscribers.add(callback)
  }

  /**
   * Unsubscribe from trade events
   */
  unsubscribeFromTrades(callback: TradeCallback): void {
    this.tradeSubscribers.delete(callback)
  }

  /**
   * Handle incoming tick updates
   */
  private handleTickUpdate(tick: TickData): void {
    const subscribers = this.tickSubscribers.get(tick.symbol)
    if (subscribers) {
      subscribers.forEach(callback => callback(tick))
    }
  }

  /**
   * Handle incoming candle updates
   */
  private handleCandleUpdate(candle: CandleData): void {
    const key = `${candle.symbol}:${candle.timeframe}`
    const subscribers = this.candleSubscribers.get(key)
    if (subscribers) {
      subscribers.forEach(callback => callback(candle))
    }
  }

  /**
   * Handle incoming trade updates
   */
  private handleTradeUpdate(trade: TradeEvent): void {
    this.tradeSubscribers.forEach(callback => callback(trade))
  }

  /**
   * Resubscribe to all symbols after reconnection
   */
  private async resubscribeToSymbols(): Promise<void> {
    for (const symbol of this.tickSubscribers.keys()) {
      try {
        await this.liveDataConnection?.invoke('SubscribeToSymbol', symbol)
        console.log(`✅ Resubscribed to ${symbol}`)
      } catch (error) {
        console.error(`❌ Failed to resubscribe to ${symbol}:`, error)
      }
    }
  }

  /**
   * Disconnect all hubs
   */
  async disconnectAll(): Promise<void> {
    this.isDisconnecting = true
    
    const promises: Promise<void>[] = []

    if (this.liveDataConnection && this.liveDataConnection.state !== signalR.HubConnectionState.Disconnected) {
      promises.push(this.liveDataConnection.stop().catch(err => {
        // Ignore errors during disconnect
        console.debug('Live Data Hub disconnect error (expected):', err.message)
      }))
    }
    if (this.chartConnection && this.chartConnection.state !== signalR.HubConnectionState.Disconnected) {
      promises.push(this.chartConnection.stop().catch(err => {
        console.debug('Chart Hub disconnect error (expected):', err.message)
      }))
    }
    if (this.tradingConnection && this.tradingConnection.state !== signalR.HubConnectionState.Disconnected) {
      promises.push(this.tradingConnection.stop().catch(err => {
        console.debug('Trading Hub disconnect error (expected):', err.message)
      }))
    }

    if (promises.length > 0) {
      await Promise.all(promises)
      console.log('✅ All WebSocket connections closed')
    }
    
    // Reset connections
    this.liveDataConnection = null
    this.chartConnection = null
    this.tradingConnection = null
    
    // Reset flag after a delay
    setTimeout(() => {
      this.isDisconnecting = false
    }, 1000)
  }

  /**
   * Get connection state
   */
  getConnectionState(): {
    liveData: string
    chart: string
    trading: string
  } {
    return {
      liveData: this.liveDataConnection?.state || 'Disconnected',
      chart: this.chartConnection?.state || 'Disconnected',
      trading: this.tradingConnection?.state || 'Disconnected',
    }
  }
}

// Singleton instance
export const wsManager = new WebSocketManager()

// Export for easy use
export default wsManager

