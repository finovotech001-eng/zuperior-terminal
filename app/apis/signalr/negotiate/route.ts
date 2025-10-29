import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint for SignalR negotiate requests to avoid CORS issues
 * Usage: GET /apis/signalr/negotiate?hub=<hub-name>&<other-params>
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hub = searchParams.get('hub') || 'mobiletrading';
    
    // Get all query parameters except 'hub' since we'll build the target URL
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (key !== 'hub') {
        params.append(key, value);
      }
    });

    // Build the target negotiate URL
    const TRADING_HUB_BASE = process.env.TRADING_HUB_URL || 
      (process.env.NEXT_PUBLIC_API_BASE_URL && `${process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}/hubs/${hub}`) ||
      `http://18.130.5.209:5003/hubs/${hub}`;
    
    const negotiateUrl = `${TRADING_HUB_BASE}/negotiate${params.toString() ? '?' + params.toString() : ''}`;
    
    console.log('[SignalR Negotiate Proxy] Proxying to:', negotiateUrl);

    // Forward the negotiate request
    const response = await fetch(negotiateUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Forward any authorization headers if present
        ...(request.headers.get('authorization') && {
          'Authorization': request.headers.get('authorization')!
        }),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[SignalR Negotiate Proxy] Error:', response.status, errorText);
      return NextResponse.json(
        { error: `Negotiate failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Modify the response to point WebSocket connections through our proxy
    // For now, we'll keep the original URL but this can be modified if needed
    console.log('[SignalR Negotiate Proxy] Success:', data.connectionId);
    
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('[SignalR Negotiate Proxy] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

