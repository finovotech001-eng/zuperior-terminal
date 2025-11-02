import { NextRequest, NextResponse } from 'next/server';

const MT5_API_BASE = 'http://18.175.242.21:5003';

/**
 * Proxy endpoint for MT5 chart data requests
 * No authentication required for this endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || 'EURUSD';
    const timeframe = searchParams.get('timeframe') || '15';
    const count = searchParams.get('count') || '300';

    console.log('[Chart Proxy] Request params:', { symbol, timeframe, count });

    // Construct MT5 API URL
    const mt5Url = `${MT5_API_BASE}/api/chart/candle/history/${symbol}?timeframe=${timeframe}&count=${count}`;

    
    console.log('[Chart Proxy] Fetching from MT5:', mt5Url);

    // Fetch from MT5 API - no authentication needed
    let response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      response = await fetch(mt5Url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
    } catch (fetchError) {
      console.error('[Chart Proxy] Network error:', fetchError);
      
      // Return a mock response for testing when the API is down
      const mockData = [
        {
          time: new Date().toISOString(),
          open: 1.16590,
          high: 1.16600,
          low: 1.16580,
          close: 1.16595,
          volume: 10,
          tickVolume: 0,
          spread: 3
        }
      ];
      
      console.warn('[Chart Proxy] Using mock data due to network error');
      return NextResponse.json(mockData, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json',
        },
      });
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[Chart Proxy] MT5 API error:', response.status, errorText);

      // Return mock data on error
      const mockData = [
        {
          time: new Date().toISOString(),
          open: 1.16590,
          high: 1.16600,
          low: 1.16580,
          close: 1.16595,
          volume: 10,
          tickVolume: 0,
          spread: 3
        }
      ];
      
      console.warn('[Chart Proxy] Using mock data due to API error');
      return NextResponse.json(mockData, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json',
        },
      });

    }

    const data = await response.json();

    console.log('[Chart Proxy] Successfully fetched', data.length, 'candles');

    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Chart Proxy] Error proxying request:', error);
    
    // Return mock data as fallback
    const mockData = [
      {
        time: new Date().toISOString(),
        open: 1.16590,
        high: 1.16600,
        low: 1.16580,
        close: 1.16595,
        volume: 10,
        tickVolume: 0,
        spread: 3
      }
    ];
    
    return NextResponse.json(mockData, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json',
      },
    });
  }
}

// Also handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

