import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const LIVE_API_URL = process.env.LIVE_API_URL || 'http://18.175.242.21:5003/api'

/**
 * Get Client Access Token using AccountId and password
 */
async function getClientToken(accountId: string): Promise<{ token: string | null; accountId: string | null; error: string | null }> {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return { token: null, accountId: null, error: 'Unauthorized. Please log in.' }
    }

    // Get MT5 account credentials from database
    const mt5Account = await prisma.mT5Account.findFirst({
      where: {
        accountId: accountId,
        userId: session.userId,
      },
      select: {
        accountId: true,
        password: true,
      },
    })

    if (!mt5Account) {
      return { token: null, accountId: null, error: 'MT5 account not found or access denied' }
    }

    if (!mt5Account.password) {
      return { token: null, accountId: null, error: 'MT5 account password not configured' }
    }

    // Authenticate with client credentials
    const loginUrl = `${LIVE_API_URL.replace(/\/$/, '')}/client/ClientAuth/login`
    
    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        AccountId: parseInt(mt5Account.accountId, 10),
        Password: mt5Account.password,
        DeviceId: `web_${session.userId}`,
        DeviceType: 'web',
      }),
    })

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text().catch(() => 'No response body')
      logger.error('Client login failed', new Error(errorText))
      return { token: null, accountId: null, error: `Client login failed: ${loginResponse.status}` }
    }

    const loginData = await loginResponse.json()
    const token = loginData?.accessToken || loginData?.AccessToken || loginData?.Token || loginData?.token || null

    if (!token) {
      return { token: null, accountId: null, error: 'No access token in response' }
    }

    return { token, accountId: mt5Account.accountId, error: null }
  } catch (error) {
    logger.error('Client token fetch error', error)
    return { token: null, accountId: null, error: 'Network error' }
  }
}

/**
 * GET /apis/tradehistory/trades
 * Get trade history from external API using AccountId and client bearer token
 */
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters - only accountId is needed
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')

    // Validate AccountId
    if (!accountId) {
      return NextResponse.json(
        { success: false, message: 'AccountId is required' },
        { status: 400 }
      )
    }

    // Build query string with only accountId
    const tradesApiUrl = `http://18.175.242.21:5003/api/client/tradehistory/trades?accountId=${accountId}`

    // Get client access token using AccountId
    const { token: accessToken, accountId: verifiedAccountId, error: tokenError } = await getClientToken(accountId)
    if (!accessToken || !verifiedAccountId) {
      return NextResponse.json(
        { success: false, message: tokenError || 'Failed to get authentication token' },
        { status: 503 }
      )
    }

    // Fetch trade history from external API with AccountId header and bearer token
    // NOTE: In Postman, you might send AccountId as a query param AND/OR header
    // This implementation sends it as both query param and header for compatibility
    logger.info('Fetching trade history from external API', { 
      url: tradesApiUrl, 
      accountId: verifiedAccountId,
      headers: {
        Authorization: 'Bearer ***',
        AccountId: verifiedAccountId,
      }
    })
    
    const tradesResponse = await fetch(tradesApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'AccountId': verifiedAccountId,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    // Log response status and headers for debugging
    logger.info('Trade history API response', {
      status: tradesResponse.status,
      statusText: tradesResponse.statusText,
      headers: Object.fromEntries(tradesResponse.headers.entries()),
    })

    if (!tradesResponse.ok) {
      const errorText = await tradesResponse.text().catch(() => 'No response body')
      logger.error('Failed to fetch trade history', { 
        status: tradesResponse.status,
        error: errorText.substring(0, 500),
        url: tradesApiUrl
      })
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to fetch trade history from external API',
          error: errorText.substring(0, 200),
          status: tradesResponse.status
        },
        { status: tradesResponse.status }
      )
    }

    // Get raw response text first for debugging
    const responseText = await tradesResponse.text()
    logger.info('Trade history API raw response', {
      length: responseText.length,
      preview: responseText.substring(0, 500),
    })

    let data: any
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      logger.error('Failed to parse JSON response', { 
        error: parseError,
        responsePreview: responseText.substring(0, 500)
      })
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid JSON response from API',
          rawResponse: responseText.substring(0, 200)
        },
        { status: 500 }
      )
    }

    // Log parsed data structure
    logger.info('Trade history API parsed response', {
      type: typeof data,
      isArray: Array.isArray(data),
      keys: data && typeof data === 'object' ? Object.keys(data) : null,
      dataLength: Array.isArray(data) ? data.length : 'N/A',
      sample: Array.isArray(data) && data.length > 0 ? data[0] : data
    })

    // Handle different response formats from the external API
    // Based on the API response, it returns { Items: [...], Page: 1, PageSize: 50, TotalCount: 50, etc. }
    let trades = []
    if (Array.isArray(data)) {
      trades = data
      logger.info(`Found direct array with ${trades.length} trades`)
    } else if (data && typeof data === 'object') {
      // Try various common response formats - API returns Items array (PascalCase)
      trades = data.Items || data.Data || data.data || data.trades || data.items || data.results || data.Results || []
      logger.info(`Extracted trades from object: ${trades.length}`, {
        source: data.Items ? 'Items' :
                data.Data ? 'Data' : 
                data.data ? 'data' : 
                data.trades ? 'trades' : 
                data.items ? 'items' : 
                data.results ? 'results' : 
                data.Results ? 'Results' : 'none',
        allKeys: Object.keys(data)
      })
      // If still not an array, wrap it
      if (!Array.isArray(trades)) {
        logger.warn('Trades is not an array', { trades, type: typeof trades, allKeys: Object.keys(data || {}) })
        trades = []
      }
    } else {
      logger.warn('Unexpected response format', { data, type: typeof data })
      trades = []
    }

    logger.info(`Fetched ${trades.length} trades from external API`)
    
    // DETAILED PRINT: Log full response for debugging
    console.log('\n' + '='.repeat(80))
    console.log('TRADE HISTORY API RESPONSE')
    console.log('='.repeat(80))
    console.log('Total trades fetched:', trades.length)
    console.log('Response structure keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A')
    console.log()
    
    if (trades.length > 0) {
      console.log('ALL TRADES:')
      trades.forEach((trade, index) => {
        console.log(`\n[${index + 1}] Trade:`)
        console.log(`  OrderId: ${trade.OrderId}`)
        console.log(`  Symbol: "${trade.Symbol}"`)
        console.log(`  OrderType: ${trade.OrderType}`)
        console.log(`  Volume: ${trade.Volume}`)
        console.log(`  OpenPrice: ${trade.OpenPrice}`)
        console.log(`  ClosePrice: ${trade.ClosePrice}`)
        console.log(`  Profit: ${trade.Profit}`)
        console.log(`  TakeProfit: ${trade.TakeProfit}`)
        console.log(`  StopLoss: ${trade.StopLoss}`)
      })
      
      console.log('\n' + '-'.repeat(80))
      console.log('FIRST TRADE (FULL JSON):')
      console.log(JSON.stringify(trades[0], null, 2))
      console.log('='.repeat(80) + '\n')
      
      logger.info('Sample trade structure', { 
        sample: trades[0],
        keys: Object.keys(trades[0])
      })
    } else {
      console.warn('⚠️  No trades found in response!')
      console.log('Full API response:')
      console.log(JSON.stringify(data, null, 2))
      console.log('='.repeat(80) + '\n')
    }

    // Return in a consistent format with pagination info
    return NextResponse.json({
      success: true,
      data: trades,
      pagination: {
        page: data.Page || data.page || 1,
        pageSize: data.PageSize || data.pageSize || 50,
        totalCount: data.TotalCount || data.totalCount || data.total || data.Total || trades.length,
        totalPages: data.TotalPages || data.totalPages || Math.ceil((data.TotalCount || trades.length) / (data.PageSize || 50)),
        hasNextPage: data.HasNextPage !== undefined ? data.HasNextPage : (data.hasNextPage !== undefined ? data.hasNextPage : false),
        hasPreviousPage: data.HasPreviousPage !== undefined ? data.HasPreviousPage : (data.hasPreviousPage !== undefined ? data.hasPreviousPage : false),
      },
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
  } catch (error) {
    logger.error('Trade history fetch failed', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

