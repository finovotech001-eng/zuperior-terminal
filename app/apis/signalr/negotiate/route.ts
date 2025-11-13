import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';

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
      `https://metaapi.zuperior.com/hubs/${hub}`;
    
    const negotiateUrl = `${TRADING_HUB_BASE}/negotiate${params.toString() ? '?' + params.toString() : ''}`;
    
    console.log('[SignalR Negotiate Proxy] Proxying to:', negotiateUrl);

    // Forward the negotiate request
    // Collect optional auth headers from the incoming request or query params
    const incomingHeaders = request.headers;
    let clientToken = incomingHeaders.get('x-client-token') || searchParams.get('clientToken') || undefined;
    let accountId = incomingHeaders.get('x-account-id') || searchParams.get('accountId') || undefined;
    let managerToken = incomingHeaders.get('x-manager-token') || process.env.MANAGER_AUTH_TOKEN || undefined;

    // If client token not provided, try to obtain a client access token using the logged-in user's MT5 account
    if (!clientToken) {
      try {
        const session = await getSession();
        if (session?.userId) {
          let acct: { accountId: string; password: string | null } | null = null;
          if (accountId) {
            acct = await prisma.mT5Account.findFirst({ where: { userId: session.userId, accountId: String(accountId) }, select: { accountId: true, password: true } })
              || await prisma.mT5Account.findFirst({ where: { accountId: String(accountId) }, select: { accountId: true, password: true } });
          } else {
            acct = await prisma.mT5Account.findFirst({ where: { userId: session.userId }, select: { accountId: true, password: true } });
          }
          if (acct?.password) {
            const RAW_BASE = (process.env.MT5_API_BASE || process.env.LIVE_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://metaapi.zuperior.com').replace(/\/$/, '')
            const API_BASE = RAW_BASE.endsWith('/api') ? RAW_BASE : `${RAW_BASE}/api`;
            const loginRes = await fetch(`${API_BASE}/client/ClientAuth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              cache: 'no-store',
              body: JSON.stringify({ AccountId: parseInt(acct.accountId, 10), Password: acct.password, DeviceId: `web_sigr_${Date.now()}`, DeviceType: 'web' })
            });
            if (loginRes.ok) {
              const loginJson = await loginRes.json().catch(() => ({} as any));
              clientToken = loginJson?.accessToken || loginJson?.AccessToken || loginJson?.Token || undefined;
              accountId = acct.accountId;
            }
          }
        }
      } catch {}
    }

    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(incomingHeaders.get('authorization') ? { 'Authorization': incomingHeaders.get('authorization')! } : {}),
      ...(clientToken ? { 'X-Client-Token': clientToken } : {}),
      ...(accountId ? { 'X-Account-ID': accountId } : {}),
      ...(managerToken ? { 'X-Manager-Token': managerToken } : {}),
    };

    const response = await fetch(negotiateUrl, {
      method: 'GET',
      headers: forwardHeaders,
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

// Support POST negotiate (some SignalR clients POST negotiate)
export async function POST(request: NextRequest) {
  try {
    // Reuse GET logic by converting POST to GET-style handling (no body needed for negotiate)
    return GET(request)
  } catch (error) {
    console.error('[SignalR Negotiate Proxy][POST] Exception:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
