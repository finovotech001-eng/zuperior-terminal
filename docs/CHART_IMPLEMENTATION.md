# Chart Implementation Guide

This project now supports two chart implementations for displaying live MT5 data:

## Chart Types

### 1. **TradingView Chart** (Default)
- Full-featured TradingView charting library
- Advanced drawing tools, indicators, and analysis
- More resource-intensive
- Located in `components/chart/advanced-chart.tsx`

### 2. **Lightweight Chart**
- Lightweight Charts library (simpler alternative)
- Faster and lighter
- Based on your reference implementation
- Located in `components/chart/lightweight-chart.tsx`

## API Endpoint

The charts fetch data from the MT5 API via a Next.js proxy:

**API Endpoint:** `http://18.130.5.209:5003/api/chart/candle/history/{SYMBOL}?timeframe={TIMEFRAME}&count={COUNT}`

**Next.js Proxy:** `/apis/chart/proxy?symbol={SYMBOL}&timeframe={TIMEFRAME}&count={COUNT}`

### Example API Response:
```json
[
  {
    "time": "2025-10-28T20:25:00",
    "open": 1.16591,
    "high": 1.16591,
    "low": 1.16571,
    "close": 1.16573,
    "volume": 33,
    "tickVolume": 0,
    "spread": 3
  }
]
```

## Usage

### Using ChartContainer Component

```tsx
import { ChartContainer } from "@/components/chart/chart-container"

// Use TradingView chart (default)
<ChartContainer 
  symbol="EURUSD" 
  className="h-full"
/>

// Use Lightweight chart
<ChartContainer 
  symbol="EURUSD" 
  className="h-full"
  chartType="lightweight"
/>
```

### Using Individual Chart Components

```tsx
import { LightweightChart } from "@/components/chart/lightweight-chart"
import { AdvancedChart } from "@/components/chart/advanced-chart"

// Lightweight chart
<LightweightChart symbol="EURUSD" className="h-full" />

// TradingView chart
<AdvancedChart 
  symbol="EURUSD" 
  symbolName="Euro vs US Dollar"
  className="h-full"
/>
```

## Testing

### 1. Test Page
Navigate to `/chart-test` to see a working example with symbol selector.

### 2. Terminal Page
The main trading terminal at `/terminal` uses the TradingView chart by default. To switch to Lightweight chart, update line 1862 in `app/terminal/page.tsx`:

```tsx
chartType="lightweight" // Change from "tradingview"
```

## API Proxy Implementation

The proxy at `app/apis/chart/proxy/route.ts` handles:
- CORS headers
- Error handling
- Request timeout (10 seconds)
- Data transformation from MT5 API format to chart format

## Supported Symbols

The following symbols are pre-configured:
- EURUSD
- GBPUSD
- USDJPY
- XAUUSD (Gold)
- XAGUSD (Silver)
- BTCUSD

## Supported Timeframes

- 1, 5, 15, 30, 60 (minutes)
- 240 (4 hours)
- D (Daily)
- W (Weekly)
- M (Monthly)

## Customization

### Lightweight Chart Colors
Edit `components/chart/lightweight-chart.tsx` to customize:
- Candlestick colors (up/down)
- Volume colors
- Grid colors
- Background color

### TradingView Chart Theme
Edit `components/chart/advanced-chart.tsx` to customize the TradingView theme and features.

## Troubleshooting

### Chart not loading?
1. Check browser console for errors
2. Verify the MT5 API is accessible
3. Check network tab for failed requests
4. Ensure the API proxy route is working at `/apis/chart/proxy`

### No data displayed?
1. Verify the symbol is supported
2. Check API response format matches expected structure
3. Ensure timeframe parameter is valid

### CORS errors?
The API proxy handles CORS, but if issues persist, check:
1. MT5 API server configuration
2. Next.js proxy settings
3. Browser security settings

## Reference Implementation

The Lightweight Chart implementation is based on the provided reference files:
- `index.html` - HTML structure
- `index.js` - JavaScript chart logic

These were adapted to work with Next.js and the MT5 API proxy.

