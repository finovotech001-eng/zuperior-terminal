"use client"

import * as React from "react"
import { LightweightChart } from "@/components/chart/lightweight-chart"

export default function ChartTestPage() {
  const [symbol, setSymbol] = React.useState("EURUSD")
  const [isClient, setIsClient] = React.useState(false)
  const symbols = ["EURUSD", "GBPUSD", "XAUUSD", "USDJPY"]

  // Prevent hydration mismatch by only rendering on client
  React.useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#01040D] p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">
            Chart Test - Live MT5 Data
          </h1>
          <div className="bg-[#01040D] rounded-lg border border-white/8 overflow-hidden flex items-center justify-center" style={{ height: '600px' }}>
            <div className="text-white/60">Loading chart...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#01040D] p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">
          Chart Test - Live MT5 Data
        </h1>
        
        <div className="mb-4">
          <label className="text-white/80 text-sm mb-2 block">
            Select Symbol:
          </label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-white/10 border border-white/20 rounded px-4 py-2 text-white"
          >
            {symbols.map((s) => (
              <option key={s} value={s} className="bg-[#01040D]">
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-[#01040D] rounded-lg border border-white/8 overflow-hidden" style={{ height: '600px' }}>
          <LightweightChart symbol={symbol} className="w-full h-full" />
        </div>

        <div className="mt-4 text-sm text-white/60">
          <p>API Endpoint: <code className="bg-white/10 px-2 py-1 rounded">http://18.175.242.21:5003/api/chart/candle/history/</code></p>
          <p className="mt-2">Current Symbol: <span className="text-white">{symbol}</span></p>
        </div>
      </div>
    </div>
  )
}

