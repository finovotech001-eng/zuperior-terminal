import { NextRequest, NextResponse } from 'next/server';

const MT5_API_BASE = 'http://18.130.5.209:5003';

/**
 * Proxy endpoint for MT5 chart data requests
 * No authentication required for this endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const timeframe = searchParams.get('timeframe');
    const count = searchParams.get('count');

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { error: 'Missing symbol or timeframe parameter' },
        { status: 400 }
      );
    }

    // Construct MT5 API URL
    const mt5Url = `${MT5_API_BASE}/api/chart/candle/history/${symbol}?timeframe=${timeframe}${count ? `&count=${count}` : ''}`;
    
    console.log('[Chart Proxy] Fetching from MT5:', mt5Url);

    // Fetch from MT5 API - no authentication needed
    const response = await fetch(mt5Url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add a timeout to prevent hanging
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[Chart Proxy] MT5 API error:', response.status, errorText);
      return NextResponse.json(
        { error: `MT5 API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=1', // Cache for 1 second
      },
    });
  } catch (error) {
    console.error('[Chart Proxy] Error proxying request:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch chart data',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
