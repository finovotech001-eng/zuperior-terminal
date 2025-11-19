import { NextRequest, NextResponse } from 'next/server'

const MT5_API_BASE = 'https://metaapi.zuperior.com'

// Proxy endpoint for live tick data (Bid/Ask/Last)
export async function GET(request: NextRequest, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params
  const mt5Url = `${MT5_API_BASE}/api/livedata/tick/${encodeURIComponent(symbol)}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    const resp = await fetch(mt5Url, { signal: controller.signal, headers: { 'Content-Type': 'application/json' } })
    clearTimeout(timeoutId)

    if (!resp.ok) {
      // Fallback mock tick
      const mock = [{ Bid: 0, Ask: 0, Last: 0 }]
      return NextResponse.json(mock, { headers: corsHeaders() })
    }

    const data = await resp.json()
    return NextResponse.json(data, { headers: { ...corsHeaders(), 'Cache-Control': 'no-store' } })
  } catch (error) {
    const mock = [{ Bid: 0, Ask: 0, Last: 0 }]
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

