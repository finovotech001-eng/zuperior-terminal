"use client"

import { AdvancedChart } from "./advanced-chart"
import { LightweightChart } from "./lightweight-chart"
import { MT5TradingViewChart } from "./mt5-tradingview-chart"

export interface ChartContainerProps {
  symbol?: string
  interval?: string
  height?: number
  className?: string
  chartType?: "tradingview" | "lightweight" | "tradingview-mt5"
}

// Helper function to get descriptive name from symbol
function getSymbolName(symbol: string): string {
  const symbolNames: Record<string, string> = {
    'EUR/USD': 'Euro vs US Dollar',
    'GBP/USD': 'British Pound vs US Dollar',
    'USD/JPY': 'US Dollar vs Japanese Yen',
    'XAU/USD': 'Gold vs US Dollar',
    'XAG/USD': 'Silver vs US Dollar',
    'BTC/USD': 'Bitcoin vs US Dollar',
    'ETH/USD': 'Ethereum vs US Dollar',
    'AAPL': 'Apple Inc.',
    'GOOGL': 'Alphabet Inc.',
    'MSFT': 'Microsoft Corporation',
    'USTEC': 'US Tech 100 Index',
    'US500': 'S&P 500 Index',
    'US100': 'NASDAQ 100 Index',
    'UK100': 'FTSE 100 Index',
    'JP225': 'Nikkei 225 Index',
    'USOIL': 'Crude Oil',
    'EURUSD': 'Euro vs US Dollar',
  }
  
  return symbolNames[symbol] || symbol
}

export function ChartContainer({ 
  symbol = "EURUSD",
  className,
  chartType = "tradingview"
}: ChartContainerProps) {
  // Normalize symbol by removing slashes
  const normalizedSymbol = symbol.replace(/\//g, '')

  if (chartType === "tradingview-mt5") {
    return (
      <MT5TradingViewChart
        symbol={normalizedSymbol}
        className={className}
      />
    )
  }

  if (chartType === "lightweight") {
    return (
      <LightweightChart
        symbol={normalizedSymbol}
        className={className}
      />
    )
  }

  return (
    <AdvancedChart
      symbol={normalizedSymbol}
      symbolName={getSymbolName(symbol)}
      className={className}
    />
  )
}
