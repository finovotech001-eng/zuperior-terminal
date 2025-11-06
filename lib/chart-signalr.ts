"use client"

import * as signalR from '@microsoft/signalr'

interface CandleData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
  tickVolume?: number
}

interface TickData {
  bid: number
  ask: number
  spread: number
}

export class ChartSignalR {
  private chartConnection: signalR.HubConnection | null = null
  private liveDataConnection: signalR.HubConnection | null = null
  private isConnected = false
  private currentSymbol: string | null = null
  private onCandleUpdate: ((candle: CandleData) => void) | null = null
  private onTickUpdate: ((tick: TickData) => void) | null = null

  constructor() {
    this.initConnections()
  }

  private async initConnections() {
    try {
      // Chart connection for historical and live candles
      this.chartConnection = new signalR.HubConnectionBuilder()
        .withUrl("http://18.175.242.21:5003/hubs/chart")
        .build()

      this.liveDataConnection = new signalR.HubConnectionBuilder()
        .withUrl("http://18.175.242.21:5003/hubs/livedata")
        .build()

      // Setup event handlers
      this.setupEventHandlers()

      // Start connections
      await Promise.all([
        this.chartConnection.start(),
        this.liveDataConnection.start()
      ])

      this.isConnected = true
      console.log("✅ SignalR connections established")
    } catch (error) {
      console.error("❌ SignalR connection failed:", error)
    }
  }

  private setupEventHandlers() {
    if (!this.chartConnection || !this.liveDataConnection) return

    // Historical candles response
    this.chartConnection.on("HistoricalCandles", (data: { candles: CandleData[] }) => {
      console.log("📊 Historical candles:", data.candles)
      // Process historical data for chart initialization
      this.processHistoricalCandles(data.candles)
    })

    // Live candle updates
    this.chartConnection.on("CandleUpdate", (data: { candle: CandleData }) => {
      console.log("🔴 Live candle update:", data.candle)
      if (this.onCandleUpdate) {
        this.onCandleUpdate(data.candle)
      }
    })

    // Live tick updates (bid/ask)
    this.liveDataConnection.on("TickUpdate", (data: TickData) => {
      console.log("💹 Tick update:", data)
      if (this.onTickUpdate) {
        this.onTickUpdate(data)
      }
    })
  }

  async subscribeToSymbol(symbol: string, timeframe: number = 1, candleCount: number = 500) {
    if (!this.isConnected || !this.chartConnection || !this.liveDataConnection) {
      console.error("❌ SignalR not connected")
      return
    }

    try {
      this.currentSymbol = symbol

      // Get historical candles
      await this.chartConnection.invoke("GetHistoricalCandles", symbol, timeframe, candleCount)

      // Subscribe to live candle updates
      await this.chartConnection.invoke("SubscribeToCandles", symbol, timeframe)

      // Subscribe to live tick data
      await this.liveDataConnection.invoke("SubscribeToTicks", symbol)

      console.log(`✅ Subscribed to ${symbol} with timeframe ${timeframe}`)
    } catch (error) {
      console.error("❌ Subscription failed:", error)
    }
  }

  async unsubscribeFromSymbol(symbol: string, timeframe: number = 1) {
    if (!this.isConnected || !this.chartConnection || !this.liveDataConnection) return

    try {
      await this.chartConnection.invoke("UnsubscribeFromCandles", symbol, timeframe)
      await this.liveDataConnection.invoke("UnsubscribeFromTicks", symbol)
      console.log(`✅ Unsubscribed from ${symbol}`)
    } catch (error) {
      console.error("❌ Unsubscription failed:", error)
    }
  }

  private processHistoricalCandles(candles: CandleData[]) {
    // Convert to chart format and initialize chart
    const chartData = candles.map(candle => ({
      time: new Date(candle.time).getTime() / 1000, // Convert to timestamp
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume || candle.tickVolume || 0
    }))

    // Initialize your chart with this data
    console.log("📈 Processed chart data:", chartData.length, "candles")
  }

  setCandleUpdateHandler(handler: (candle: CandleData) => void) {
    this.onCandleUpdate = handler
  }

  setTickUpdateHandler(handler: (tick: TickData) => void) {
    this.onTickUpdate = handler
  }

  async disconnect() {
    try {
      if (this.currentSymbol) {
        await this.unsubscribeFromSymbol(this.currentSymbol)
      }
      
      await Promise.all([
        this.chartConnection?.stop(),
        this.liveDataConnection?.stop()
      ])
      
      this.isConnected = false
      console.log("✅ SignalR disconnected")
    } catch (error) {
      console.error("❌ Disconnect failed:", error)
    }
  }
}