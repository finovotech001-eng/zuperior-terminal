// app/api/trading/route.ts

import { NextRequest, NextResponse } from 'next/server';

const EXTERNAL_API_BASE_URL = 'http://18.130.5.209:5003/api/client';


interface CloseData {
  Volume?: number;
  Price?: number;
  Comment?: string;
  positionId: string | number;
}

// --- Helper Functions ---
async function proxyRequest(
  endpoint: string,
  method: 'POST' | 'DELETE',
  body: Record<string, unknown> | null = null,
  authToken: string | null = null
) {
  const url = `${EXTERNAL_API_BASE_URL}/${endpoint}`;

  if (!EXTERNAL_API_BASE_URL) {
    console.error('[Proxy Error] Missing EXTERNAL_API_BASE_URL configuration');
    return NextResponse.json(
      { Success: false, Error: 'Configuration Error: External API URL is missing.' },
      { status: 500 }
    );
  }

  console.log(`[ProxyRequest] → ${method} ${url}`);
  if (body) console.log('[ProxyRequest] Body:', body);

  try {
    const fetchOptions: RequestInit = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': authToken }),
      },
      ...(body && { body: JSON.stringify(body) }),
    };

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    console.log(`[ProxyResponse] ← Status: ${response.status}`);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`[ProxyRequest Error] ${method} ${url}:`, error);
    return NextResponse.json(
      { Success: false, Error: 'Internal Server Error during trade request.' },
      { status: 500 }
    );
  }
}

// --- Route Handlers ---

export async function POST(request: NextRequest) {
  console.log('💡 [API HIT] POST /api/trading');

  try {
    const authToken = request.headers.get('Authorization');
    if (!authToken) {
      console.warn('[Auth Warning] Missing Authorization token');
      return NextResponse.json({ Success: false, Message: 'Authorization token is missing.' }, { status: 401 });
    }

    const { orderType, accountId, ...orderData } = await request.json();

    console.log(`[Trade Request] Type: ${orderType}, Account: ${accountId}`);

    if (!accountId) {
      return NextResponse.json({ Success: false, Message: 'Missing accountId for trade operation.' }, { status: 400 });
    }

    let endpoint = '';
    if (orderType === 'BUY') {
      endpoint = `trade?account_id=${accountId}`;
    } else if (orderType === 'SELL') {
      endpoint = `trade-sell?account_id=${accountId}`;
    } else {
      console.warn('[Validation Warning] Invalid orderType received:', orderType);
      return NextResponse.json({ Success: false, Message: 'Invalid orderType specified.' }, { status: 400 });
    }

    return proxyRequest(endpoint, 'POST', orderData, authToken);
  } catch (error) {
    console.error('[POST Error] Invalid request body:', error);
    return NextResponse.json({ Success: false, Error: `Invalid POST request body: ${error}` }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  console.log('💡 [API HIT] DELETE /api/trading');

  try {
    const authToken = request.headers.get('Authorization');
    if (!authToken) {
      console.warn('[Auth Warning] Missing Authorization token');
      return NextResponse.json({ Success: false, Message: 'Authorization token is missing.' }, { status: 401 });
    }

    const { positionId, ...closeData } = await request.json() as CloseData & { positionId: number | string };

    console.log(`[Close Request] Position ID: ${positionId}`);

    if (!positionId) {
      return NextResponse.json({ Success: false, Message: 'Missing positionId for close operation.' }, { status: 400 });
    }

    const endpoint = `position/${positionId}`;
    return proxyRequest(endpoint, 'DELETE', closeData, authToken);
  } catch (error) {
    console.error('[DELETE Error] Invalid request body:', error);
    return NextResponse.json({ Success: false, Error: `Invalid DELETE request body: ${error}` }, { status: 400 });
  }
}