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

  console.log(`[ProxyRequest] ${method} ${url}`);
  if (body) console.log('[ProxyRequest] Body:', body);

  try {
    const fetchOptions: RequestInit = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: authToken }),
      },
      ...(body && { body: JSON.stringify(body) }),
    };

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    console.log(`[ProxyResponse] Status: ${response.status}`);
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
  console.log('[API HIT] POST /api/trading');

  try {
    const authToken = request.headers.get('Authorization');
    if (!authToken) {
      console.warn('[Auth Warning] Missing Authorization token');
      return NextResponse.json({ Success: false, Message: 'Authorization token is missing.' }, { status: 401 });
    }

    const body = await request.json();
    const merged = { ...(body || {}), ...(body?.order || {}) } as Record<string, unknown>;
    const {
      orderType,
      side,
      accountId,
      symbol,
      volume,
      price,
      stopLoss,
      takeProfit,
      comment,
    } = merged as {
      orderType?: string;
      side?: string;
      accountId?: string | number;
      symbol?: string;
      volume?: number;
      price?: number;
      stopLoss?: number;
      takeProfit?: number;
      comment?: string;
    };

    const sideText = (side || '').toString().toLowerCase();
    const orderTypeText = (orderType || '').toString().toLowerCase();
    const isSell = sideText === 'sell' || orderTypeText.startsWith('sell');
    const effectiveSide = isSell ? 'sell' : (sideText || orderTypeText || 'buy');
    console.log(`[Trade Request] Side: ${effectiveSide} (raw: side=${sideText}, orderType=${orderTypeText}), Account: ${accountId}`);

    if (!accountId || !symbol || typeof volume !== 'number') {
      return NextResponse.json(
        { Success: false, Message: 'Missing required fields (accountId, symbol, volume).' },
        { status: 400 }
      );
    }

    const path = effectiveSide === 'sell' ? 'trade-sell' : 'trade';
    const endpoint = `${path}?account_id=${accountId}`;

    // Market vs limit: if market or no price, send 0
    const isMarket = orderTypeText === 'market' || !orderTypeText;
    const sentPrice = isMarket || !price || Number(price) <= 0 ? 0 : Number(price);

    // Scaling rules per spec
    const scaledVolume = Math.round(Number(volume) * 100);
    const hasSL = stopLoss !== undefined && stopLoss !== null && Number(stopLoss) > 0;
    const hasTP = takeProfit !== undefined && takeProfit !== null && Number(takeProfit) > 0;
    const slValue = hasSL ? Number(stopLoss) : 0;
    const tpValue = hasTP ? Number(takeProfit) : 0;

    const finalComment = comment !== undefined ? String(comment) : (isSell ? 'Sell' : 'Buy');

    const transformed = {
      symbol: String(symbol),
      volume: scaledVolume,
      price: sentPrice,
      stopLoss: slValue,
      takeProfit: tpValue,
      comment: finalComment,
    };

    console.log('[Transformed Order]', transformed);
    return proxyRequest(endpoint, 'POST', transformed as Record<string, unknown>, authToken);
  } catch (error) {
    console.error('[POST Error] Invalid request body:', error);
    return NextResponse.json({ Success: false, Error: `Invalid POST request body: ${error}` }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  console.log('[API HIT] DELETE /api/trading');

  try {
    const authToken = request.headers.get('Authorization');
    if (!authToken) {
      console.warn('[Auth Warning] Missing Authorization token');
      return NextResponse.json({ Success: false, Message: 'Authorization token is missing.' }, { status: 401 });
    }

    const { positionId, ...closeData } = (await request.json()) as CloseData & { positionId: number | string };

    console.log(`[Close Request] Position ID: ${positionId}`);

    if (!positionId) {
      return NextResponse.json({ Success: false, Message: 'Missing positionId for close operation.' }, { status: 400 });
    }

    const endpoint = `position/${positionId}`;
    return proxyRequest(endpoint, 'DELETE', closeData as Record<string, unknown>, authToken);
  } catch (error) {
    console.error('[DELETE Error] Invalid request body:', error);
    return NextResponse.json({ Success: false, Error: `Invalid DELETE request body: ${error}` }, { status: 400 });
  }
}
