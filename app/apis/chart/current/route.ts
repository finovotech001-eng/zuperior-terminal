import { NextRequest, NextResponse } from 'next/server'

const MT5_API_BASE = 'http://18.175.242.21:5003'

// Proxy endpoint for current candle
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const symbol = searchParams.get('symbol') || 'EURUSD'
  const timeframe = searchParams.get('timeframe') || '1'

  const mt5Url = `${MT5_API_BASE}/api/chart/candle/current/${encodeURIComponent(symbol)}?timeframe=${encodeURIComponent(timeframe)}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    const resp = await fetch(mt5Url, { signal: controller.signal, headers: { 'Content-Type': 'application/json' } })
    clearTimeout(timeoutId)

    if (!resp.ok) {
      // Fallback mock
      const mock = {
        time: new Date().toISOString(),
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        volume: 0,
      }
      return NextResponse.json(mock, { headers: corsHeaders() })
    }

    const data = await resp.json()
    return NextResponse.json(data, { headers: { ...corsHeaders(), 'Cache-Control': 'no-store' } })
  } catch (error) {
    const mock = {
      time: new Date().toISOString(),
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0,
    }
    return NextResponse.json(mock, { headers: corsHeaders() })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }
}

