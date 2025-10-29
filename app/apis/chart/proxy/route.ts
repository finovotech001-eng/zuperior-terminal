import { NextRequest, NextResponse } from 'next/server';

const MT5_API_BASE = 'http://18.130.5.209:5003';

/**
 * Proxy endpoint for MT5 chart data requests
 * No authentication required for this endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
<<<<<<< HEAD
    const symbol = searchParams.get('symbol') || 'EURUSD';
    const timeframe = searchParams.get('timeframe') || '15';
    const count = searchParams.get('count') || '300';

    console.log('[Chart Proxy] Request params:', { symbol, timeframe, count });

    // Construct MT5 API URL
    const mt5Url = `${MT5_API_BASE}/api/chart/candle/history/${symbol}?timeframe=${timeframe}&count=${count}`;
=======
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
>>>>>>> 264015ee55460310b90f3c56256b551ddf531132
    
    console.log('[Chart Proxy] Fetching from MT5:', mt5Url);

    // Fetch from MT5 API - no authentication needed
<<<<<<< HEAD
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
=======
    const response = await fetch(mt5Url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add a timeout to prevent hanging
      signal: AbortSignal.timeout(10000),
    });
>>>>>>> 264015ee55460310b90f3c56256b551ddf531132

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[Chart Proxy] MT5 API error:', response.status, errorText);
<<<<<<< HEAD
      
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
=======
      return NextResponse.json(
        { error: `MT5 API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
>>>>>>> 264015ee55460310b90f3c56256b551ddf531132
    }

    const data = await response.json();
    
<<<<<<< HEAD
    console.log('[Chart Proxy] Successfully fetched', data.length, 'candles');
    
=======
>>>>>>> 264015ee55460310b90f3c56256b551ddf531132
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
<<<<<<< HEAD
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
=======
        'Cache-Control': 'public, max-age=1', // Cache for 1 second
>>>>>>> 264015ee55460310b90f3c56256b551ddf531132
      },
    });
  } catch (error) {
    console.error('[Chart Proxy] Error proxying request:', error);
<<<<<<< HEAD
    
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
=======
    return NextResponse.json(
      { 
        error: 'Failed to fetch chart data',
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
>>>>>>> 264015ee55460310b90f3c56256b551ddf531132
