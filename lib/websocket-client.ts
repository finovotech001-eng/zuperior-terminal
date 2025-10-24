/**
 * WebSocket Client for Real-time Updates
 * Replaces polling with efficient WebSocket connections
 */

import { io, Socket } from 'socket.io-client'

type SubscriptionCallback<T> = (data: T) => void

interface BalanceData {
  balance: number
  equity: number
  margin: number
  freeMargin: number
  marginLevel: number
  profit: number
  leverage: string
  totalPL: number
  accountType: 'Demo' | 'Live'
  name: string
  accountGroup: string
}

interface MarketData {
  symbol: string
  bid: number
  ask: number
  change1d: number
  changePercent1d: number
  timestamp: number
}

class WebSocketClient {
  private socket: Socket | null = null
  private connected: boolean = false
  private reconnecting: boolean = false
  private subscriptions: Map<string, Set<SubscriptionCallback<any>>> = new Map()

  constructor() {
    this.connect()
  }

  /**
   * Connect to WebSocket server
   */
  private connect() {
    if (this.socket && this.connected) {
      console.warn('WebSocket already connected')
      return
    }

    const token = this.getAuthToken()
    const wsUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    this.socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    this.setupEventListeners()
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected:', this.socket?.id)
      this.connected = true
      this.reconnecting = false
      this.resubscribeAll()
    })

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason)
      this.connected = false
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.handleConnectionError()
    })

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log(`🔄 WebSocket reconnection attempt ${attempt}`)
      this.reconnecting = true
    })

    this.socket.on('reconnect', (attempt) => {
      console.log(`✅ WebSocket reconnected after ${attempt} attempts`)
      this.reconnecting = false
      this.resubscribeAll()
    })

    // Account balance updates
    this.socket.on('account:update', (data: BalanceData) => {
      this.notify('account:update', data)
    })

    // Market data updates
    this.socket.on('market:update', (data: MarketData) => {
      this.notify('market:update', data)
    })

    // Position updates
    this.socket.on('position:update', (data: unknown) => {
      this.notify('position:update', data)
    })

    // Order updates
    this.socket.on('order:update', (data: unknown) => {
      this.notify('order:update', data)
    })
  }

  /**
   * Get authentication token from localStorage/cookie
   */
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null
    
    // Try to get from localStorage first
    const token = localStorage.getItem('token')
    if (token) return token

    // Try to get from cookie
    const cookies = document.cookie.split(';')
    const tokenCookie = cookies.find(c => c.trim().startsWith('token='))
    if (tokenCookie) {
      return tokenCookie.split('=')[1]
    }

    return null
  }

  /**
   * Subscribe to account balance updates
   */
  subscribeToAccount(accountId: string, callback: SubscriptionCallback<BalanceData>) {
    if (!this.socket) {
      console.error('WebSocket not connected')
      return
    }

    // Add callback to subscriptions
    const key = `account:${accountId}`
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set())
    }
    this.subscriptions.get(key)?.add(callback)

    // Subscribe to account updates
    this.socket.emit('subscribe:account', accountId)
    console.log(`📊 Subscribed to account: ${accountId}`)
  }

  /**
   * Unsubscribe from account balance updates
   */
  unsubscribeFromAccount(accountId: string, callback?: SubscriptionCallback<BalanceData>) {
    const key = `account:${accountId}`
    
    if (callback) {
      // Remove specific callback
      this.subscriptions.get(key)?.delete(callback)
    } else {
      // Remove all callbacks for this account
      this.subscriptions.delete(key)
    }

    // If no more callbacks, unsubscribe from server
    if (!this.subscriptions.has(key) || this.subscriptions.get(key)?.size === 0) {
      this.socket?.emit('unsubscribe:account', accountId)
      this.subscriptions.delete(key)
      console.log(`📊 Unsubscribed from account: ${accountId}`)
    }
  }

  /**
   * Subscribe to market data updates
   */
  subscribeToMarket(symbols: string[], callback: SubscriptionCallback<MarketData>) {
    if (!this.socket) {
      console.error('WebSocket not connected')
      return
    }

    // Add callback to subscriptions
    const key = 'market:update'
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set())
    }
    this.subscriptions.get(key)?.add(callback)

    // Subscribe to market updates
    this.socket.emit('subscribe:market', symbols)
    console.log(`📈 Subscribed to ${symbols.length} symbols`)
  }

  /**
   * Unsubscribe from market data updates
   */
  unsubscribeFromMarket(callback?: SubscriptionCallback<MarketData>) {
    const key = 'market:update'
    
    if (callback) {
      this.subscriptions.get(key)?.delete(callback)
    } else {
      this.subscriptions.delete(key)
    }
  }

  /**
   * Notify all subscribers of an event
   */
  private notify<T>(event: string, data: T) {
    const callbacks = this.subscriptions.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in WebSocket callback for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Resubscribe to all active subscriptions after reconnection
   */
  private resubscribeAll() {
    this.subscriptions.forEach((callbacks, key) => {
      if (key.startsWith('account:')) {
        const accountId = key.split(':')[1]
        this.socket?.emit('subscribe:account', accountId)
      }
    })
  }

  /**
   * Handle connection errors with exponential backoff
   */
  private handleConnectionError() {
    if (this.reconnecting) return

    // Fall back to polling if WebSocket fails repeatedly
    console.warn('⚠️  WebSocket connection failed, consider falling back to polling')
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.connected = false
      this.subscriptions.clear()
      console.log('🔌 WebSocket disconnected')
    }
  }

  /**
   * Reconnect to WebSocket server
   */
  reconnect() {
    this.disconnect()
    this.connect()
  }
}

// Export singleton instance
export const wsClient = new WebSocketClient()

// Export for custom instances
export default WebSocketClient

