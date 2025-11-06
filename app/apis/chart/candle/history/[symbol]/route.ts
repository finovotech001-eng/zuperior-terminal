import { NextRequest, NextResponse } from 'next/server'

const MT5_API_BASE = process.env.MT5_API_BASE || 'http://18.130.5.209:5003'

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  try {
    const { symbol } = params
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || '1'
    const count = searchParams.get('count') || '100'

    const mt5Url = `${MT5_API_BASE}/api/chart/candle/history/${symbol}?timeframe=${timeframe}&count=${count}`
    
    const response = await fetch(mt5Url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`MT5 API error: ${response.status}`)
    }

    const data = await response.json()
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Chart history API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chart history' },
      { status: 500 }
    )
  }
}