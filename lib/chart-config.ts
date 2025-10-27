import { DeepPartial, ChartOptions, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';

// Primary color constant (matching CSS --primary: #8B5CF6)
const PRIMARY_COLOR = '#8B5CF6';

// Zuperior Premium Dark Chart Theme
export const chartOptions: DeepPartial<ChartOptions> = {
  layout: {
    background: { type: ColorType.Solid, color: '#01040D' },
    textColor: '#FAFAFA',
    fontSize: 12,
    fontFamily: 'sans-serif',
  },
  grid: {
    vertLines: {
      color: `${PRIMARY_COLOR}14`, // Subtle purple tint (hex alpha for 0.08 opacity)
      style: LineStyle.Solid,
      visible: true,
    },
    horzLines: {
      color: `${PRIMARY_COLOR}14`,
      style: LineStyle.Solid,
      visible: true,
    },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: {
      color: PRIMARY_COLOR,
      width: 1,
      style: LineStyle.Dashed,
      labelBackgroundColor: `${PRIMARY_COLOR}33`, // 0.2 opacity
    },
    horzLine: {
      color: PRIMARY_COLOR,
      width: 1,
      style: LineStyle.Dashed,
      labelBackgroundColor: `${PRIMARY_COLOR}33`, // 0.2 opacity
    },
  },
  rightPriceScale: {
    borderColor: `${PRIMARY_COLOR}26`, // 0.15 opacity
  },
  timeScale: {
    borderColor: `${PRIMARY_COLOR}26`, // 0.15 opacity
    timeVisible: true,
    secondsVisible: false,
  },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: true,
  },
  handleScale: {
    axisPressedMouseMove: true,
    mouseWheel: true,
    pinch: true,
  },
};

// Candlestick series options - Premium colors
export const candlestickSeriesOptions = {
  upColor: '#16A34A',     // Success green
  downColor: '#EF4444',   // Danger red
  borderUpColor: '#16A34A',
  borderDownColor: '#EF4444',
  wickUpColor: '#16A34A',
  wickDownColor: '#EF4444',
};

// Volume series options
export const volumeSeriesOptions = {
  priceFormat: {
    type: 'volume' as const,
  },
  priceScaleId: '',
  scaleMargins: {
    top: 0.8,
    bottom: 0,
  },
  color: '#2a2a2a',
};

// Line series options (for indicators)
export const lineSeriesOptions = {
  color: PRIMARY_COLOR,
  lineWidth: 2,
  lastValueVisible: true,
  priceLineVisible: true,
};

// Area series options
export const areaSeriesOptions = {
  topColor: `${PRIMARY_COLOR}66`, // 0.4 opacity
  bottomColor: `${PRIMARY_COLOR}00`, // 0.0 opacity
  lineColor: PRIMARY_COLOR,
  lineWidth: 2,
};

// Generate sample candlestick data
export function generateSampleData(basePrice: number, numPoints: number = 100) {
  const data = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - numPoints);
  
  let currentPrice = basePrice;
  
  for (let i = 0; i < numPoints; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const time = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    const volatility = basePrice * 0.02;
    const change = (Math.random() - 0.5) * volatility;
    currentPrice += change;
    
    const high = currentPrice + Math.random() * volatility / 2;
    const low = currentPrice - Math.random() * volatility / 2;
    const open = currentPrice + (Math.random() - 0.5) * volatility / 4;
    const close = currentPrice;
    
    data.push({
      time,
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
    });
  }
  
  return data;
}

// Generate sample volume data
export function generateVolumeData(candleData: Array<{
  time: string
  open: number
  high: number
  low: number
  close: number
}>) {
  return candleData.map(candle => ({
    time: candle.time,
    value: Math.random() * 1000000,
    color: candle.close >= candle.open ? 'rgba(0, 193, 118, 0.5)' : 'rgba(255, 59, 48, 0.5)',
  }));
}

