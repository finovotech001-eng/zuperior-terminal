import { NextResponse } from 'next/server';

// 1. 🚀 CACHE: Define a global variable to hold the full instrument list and its timestamp
let instrumentCache: {
  data: any[] | null;
  timestamp: number;
  total: number;
} = {
  data: null,
  timestamp: 0,
  total: 0,
};

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes (Server-side TTL)

// --- Configuration loaded from .env.local ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const MARKET_DATA_SYMBOLS_PATH = process.env.MARKET_DATA_SYMBOLS_PATH;

// Manager Authentication details (copied for encapsulation)
const MANAGER_USERNAME = process.env.MANAGER_USERNAME;
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD;
const MANAGER_SERVER_IP = process.env.MANAGER_SERVER_IP;
const MANAGER_PORT = process.env.MANAGER_PORT;
const MANAGER_LOGIN_PATH = process.env.MANAGER_LOGIN_PATH;

// Utility function to get the Master Token
async function getMasterToken(): Promise<{ token: string | null; error: string | null }> {
  if (!API_BASE_URL || !MANAGER_USERNAME || !MANAGER_PASSWORD || !MANAGER_LOGIN_PATH) {
    return { token: null, error: 'Missing environment variables.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}${MANAGER_LOGIN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Username: MANAGER_USERNAME,
        Password: MANAGER_PASSWORD,
        Server: MANAGER_SERVER_IP,
        Port: parseInt(MANAGER_PORT || '443', 10),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body.');
      console.error(
        `Manager Login Failed. Status: ${response.status} (${response.statusText}). Body: ${errorText}`
      );

      let userFriendlyError = `Manager login failed with status ${response.status}. Please check MANAGER_USERNAME/PASSWORD.`;
      if (response.status === 401 || response.status === 403) {
        userFriendlyError = 'Manager credentials rejected by the platform API.';
      }
      return { token: null, error: userFriendlyError };
    }

    const data = await response.json();
    const token = data.Token || data.AccessToken || null;

    if (!token) {
      return { token: null, error: 'Manager login succeeded but no token was found in response body.' };
    }

    return { token: token, error: null };
  } catch (error: any) {
    let errorMessage = 'Network/SSL Error connecting to trading platform.';
    if (error.code) {
      errorMessage = `Network/SSL Error: ${error.code}. Ensure API_BASE_URL is correct and platform is running.`;
    }
    console.error('Master Token Fetch Network Error:', error);
    return { token: null, error: errorMessage };
  }
}

// Function to generate pseudo-random market data
function generateMockPrice(category: string) {
  const basePrice = Math.random() * (category === 'forex' ? 100 : 10000) + 100;
  const bid = parseFloat(basePrice.toFixed(category === 'forex' ? 5 : 2));
  const ask = parseFloat(
    (bid + (bid * 0.0001) * (category === 'forex' ? 0.5 : 1)).toFixed(
      category === 'forex' ? 5 : 2
    )
  );
  const changeFactor = (Math.random() - 0.5) * 0.03;
  const changePercent1d = parseFloat((changeFactor * 100).toFixed(2));
  const change1d = parseFloat((bid * changeFactor).toFixed(category === 'forex' ? 5 : 2));
  return { bid, ask, change1d, changePercent1d };
}

// Function to determine category based on symbol name
function determineCategory(symbol: string): string {
  const lowerSymbol = symbol.toLowerCase();
  if (lowerSymbol.includes('/') && lowerSymbol.length === 7) return 'forex';
  if (lowerSymbol.includes('usd') && lowerSymbol.length > 3) return 'crypto';
  if (lowerSymbol.startsWith('us') && lowerSymbol.length > 3) return 'indices';
  if (lowerSymbol.startsWith('x')) return 'commodities';
  return 'stocks';
}

/**
 * Handles GET requests to /apis/market-data
 * Implements server-side chunking/pagination logic based on URL parameters.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const limit = parseInt(searchParams.get('limit') || '10000', 10);

  if (!MARKET_DATA_SYMBOLS_PATH) {
    return NextResponse.json(
      { success: false, message: 'Server configuration error: Market data symbols path missing.' },
      { status: 500 }
    );
  }

  // 2. ⚡️ CACHE CHECK: Check if cache is valid and use it if possible
  const isCacheValid =
    instrumentCache.data && Date.now() - instrumentCache.timestamp < CACHE_TTL_MS;

  let zuperiorInstruments: any[] = [];
  let totalCount = 0;

  if (isCacheValid && instrumentCache.data) {
    // Cache HIT: Use cached data
    zuperiorInstruments = instrumentCache.data;
    totalCount = instrumentCache.total;
  } else {
    // Cache MISS/Expired: Proceed with external API fetch
    const { token: masterToken, error: masterTokenError } = await getMasterToken();

    if (!masterToken) {
      return NextResponse.json(
        { success: false, message: masterTokenError || 'Unknown platform connection failure.' },
        { status: 503 }
      );
    }

    // 3. Fetch the Instruments from the external platform
    const instrumentsResponse = await fetch(`${API_BASE_URL}${MARKET_DATA_SYMBOLS_PATH}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${masterToken}`,
      },
    });

    if (!instrumentsResponse.ok) {
      const errorText = await instrumentsResponse.text();
      console.error('Failed to fetch instruments:', instrumentsResponse.status, errorText);
      return NextResponse.json(
        {
          success: false,
          message: `Failed to retrieve instrument list from platform. Status: ${instrumentsResponse.status}.`,
        },
        { status: instrumentsResponse.status }
      );
    }

    // 4. Process the Data
    let rawData = await instrumentsResponse.json();

    if (!Array.isArray(rawData)) {
      let dataArray = rawData.Data || rawData.Symbols || rawData.data;

      if (Array.isArray(dataArray)) {
        rawData = dataArray;
      } else {
        rawData = [];
      }
    }

    zuperiorInstruments = rawData.map((item: any) => {
      const symbol = item.Symbol || item.Name || 'UNKNOWN';
      const id = symbol.toLowerCase().replace('/', '').replace('.', '');
      const category = determineCategory(symbol);
      const mockPrices = generateMockPrice(category);

      return {
        id,
        symbol,
        description: item.Description || symbol,
        category,
        signal: mockPrices.change1d > 0 ? 'up' : 'down',
        bid: mockPrices.bid,
        ask: mockPrices.ask,
        change1d: mockPrices.change1d,
        changePercent1d: mockPrices.changePercent1d,
        isFavorite: false,
      };
    });

    // 5. 📝 CACHE UPDATE: Store the full processed list in the cache
    totalCount = zuperiorInstruments.length;
    instrumentCache = {
      data: zuperiorInstruments,
      timestamp: Date.now(),
      total: totalCount,
    };
  }

  // 6. Apply server-side chunking/pagination (Always runs, regardless of cache hit/miss)
  const chunk = zuperiorInstruments.slice(offset, offset + limit);

  // 7. Return the processed chunk with pagination metadata
  return NextResponse.json(
    {
      success: true,
      data: chunk,
      total: totalCount,
      offset,
      limit,
    },
    { status: 200 }
  );
}
