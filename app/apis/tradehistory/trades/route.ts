import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'

// Configuration
// Prefer LIVE_API_URL, fallback to NEXT_PUBLIC_API_BASE_URL, ensure "/api" suffix exists
const RAW_API_BASE = (process.env.LIVE_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://metaapi.zuperior.com').replace(/\/$/, '')
const EXTERNAL_API_BASE = RAW_API_BASE.endsWith('/api') ? RAW_API_BASE : `${RAW_API_BASE}/api`

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
    const loginUrl = `${EXTERNAL_API_BASE}/client/ClientAuth/login`
    
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
  logger.info('Trade history API route called', { url: request.url })
  
  try {
    // Extract query parameters - only accountId is needed
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    
    logger.info('Trade history request params', {
      accountId,
      page: searchParams.get('page'),
      pageSize: searchParams.get('pageSize'),
      fromDate: searchParams.get('fromDate'),
      toDate: searchParams.get('toDate')
    })

    // Validate AccountId
    if (!accountId) {
      logger.error('Trade history request missing accountId')
      return NextResponse.json(
        { success: false, message: 'AccountId is required' },
        { status: 400 }
      )
    }
    
    logger.info('Processing trade history request', { accountId })

    // Get pagination and filter parameters
    // Defaults can be overridden via env
    const DEFAULT_PAGE_SIZE = (process.env.TRADE_HISTORY_DEFAULT_PAGE_SIZE || '500').toString()
    const DEFAULT_FROM_DATE = (process.env.TRADE_HISTORY_DEFAULT_FROM_DATE || '2024-01-01').toString()
    const DEFAULT_TO_DATE = (process.env.TRADE_HISTORY_DEFAULT_TO_DATE || '2025-12-31').toString()
    const DEFAULT_FILTER_ZERO_PROFIT = ((process.env.TRADE_HISTORY_FILTER_ZERO_PROFIT || 'true') as string).toLowerCase() === 'true'

    const page = searchParams.get('page') || '1'
    const pageSize = searchParams.get('pageSize') || DEFAULT_PAGE_SIZE
    const fromDate = searchParams.get('fromDate') || DEFAULT_FROM_DATE
    const toDate = searchParams.get('toDate') || DEFAULT_TO_DATE
    // Allow overriding profit filter via query; default taken from env
    const filterZeroProfitParam = searchParams.get('filterZeroProfit')
    const filterZeroProfit = filterZeroProfitParam != null
      ? filterZeroProfitParam.toLowerCase() === 'true'
      : DEFAULT_FILTER_ZERO_PROFIT
    const nonZeroProfit = (searchParams.get('nonZeroProfit') || '').toLowerCase() === 'true'

    // Prepare base URL and query params - use direct API endpoint without authentication
    const baseUrl = `${EXTERNAL_API_BASE}/client/tradehistory/trades`
    const baseParams = new URLSearchParams({ accountId: String(accountId) })
    // Add duplicate casing for compatibility with different backends
    baseParams.set('accountId', String(accountId))
    baseParams.set('AccountId', String(accountId))
    if (pageSize) { baseParams.set('pageSize', pageSize); baseParams.set('PageSize', pageSize) }
    if (fromDate) { baseParams.set('fromDate', fromDate); baseParams.set('FromDate', fromDate) }
    if (toDate) { baseParams.set('toDate', toDate); baseParams.set('ToDate', toDate) }

    logger.info('Using direct API endpoint without authentication', { accountId, baseUrl })

    // Fetch all pages of trade history
    let allTrades: any[] = []
    let currentPage = 1
    let hasNextPage = true
    let totalCount = 0
    let totalPages = 0
    
    while (hasNextPage) {
      const params = new URLSearchParams(baseParams)
      params.set('page', String(currentPage))
      const pageUrl = `${baseUrl}?${params.toString()}`
      
      logger.info('Fetching trade history page from external API', { 
        url: pageUrl, 
        page: currentPage,
        accountId: accountId
      })
      
      console.log('[Trade History API] Calling external endpoint:', pageUrl)
      console.log('[Trade History API] No authentication required')
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn('[Trade History API] Request timeout after 20 seconds')
        controller.abort()
      }, 20000) // 20 second timeout per page
      
      const tradesResponse = await fetch(pageUrl, {
        method: 'GET',
        headers: {
          // No authentication headers needed
          'Accept': 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId)
      })
      
      console.log('[Trade History API] External API response:', {
        status: tradesResponse.status,
        statusText: tradesResponse.statusText,
        ok: tradesResponse.ok,
        headers: Object.fromEntries(tradesResponse.headers.entries())
      })
      
      if (!tradesResponse.ok) {
        const errorText = await tradesResponse.text().catch(() => 'No response body')
        console.error('[Trade History API] External API error:', {
          status: tradesResponse.status,
          error: errorText.substring(0, 500),
          url: pageUrl
        })
        logger.error('Failed to fetch trade history page', { 
          status: tradesResponse.status,
          error: errorText.substring(0, 500),
          url: pageUrl,
          page: currentPage
        })
        // Some APIs return 400/404/422 when page exceeds range; treat as end
        if ([400, 404, 422].includes(tradesResponse.status) && currentPage > 1) {
          hasNextPage = false
          break
        }
        break
      }
      
      const responseText = await tradesResponse.text()
      let pageData: any
      
      try {
        pageData = JSON.parse(responseText)
      } catch (parseError) {
        logger.error('Failed to parse JSON response for page', { 
          error: parseError,
          page: currentPage,
          responsePreview: responseText.substring(0, 500)
        })
        break
      }
      
      // Log the raw response structure for debugging
      logger.info('Raw API response structure', {
        page: currentPage,
        isArray: Array.isArray(pageData),
        keys: pageData && typeof pageData === 'object' ? Object.keys(pageData) : [],
        responsePreview: JSON.stringify(pageData).substring(0, 1000)
      })
      
      // Extract trades from this page - try multiple possible response structures
      let pageTrades = []
      if (Array.isArray(pageData)) {
        pageTrades = pageData
        logger.info('Response is direct array', { count: pageTrades.length })
      } else if (pageData && typeof pageData === 'object') {
        // Try all possible property names for the trades array
        pageTrades = pageData.Items || 
                     pageData.Data || 
                     pageData.data || 
                     pageData.trades || 
                     pageData.items || 
                     pageData.results || 
                     pageData.Results ||
                     pageData.Trades ||
                     pageData.closedTrades ||
                     pageData.ClosedTrades ||
                     pageData.tradeHistory ||
                     pageData.TradeHistory ||
                     []
        
        // If still empty, check if the entire object is the data
        if (pageTrades.length === 0 && pageData.Success !== false) {
          // Some APIs might return the data directly in the root
          logger.warn('No trades found in expected properties, checking root object structure', {
            hasSuccess: 'Success' in pageData,
            hasMessage: 'Message' in pageData,
            allKeys: Object.keys(pageData)
          })
        }
        
        logger.info('Extracted trades from object', { 
          count: pageTrades.length,
          source: pageData.Items ? 'Items' : 
                  pageData.Data ? 'Data' :
                  pageData.data ? 'data' :
                  pageData.trades ? 'trades' :
                  pageData.items ? 'items' :
                  pageData.results ? 'results' :
                  pageData.Results ? 'Results' : 'none'
        })
      }
      
      // Add trades from this page to the collection
      allTrades = allTrades.concat(pageTrades)

      // Update pagination info
      const effectivePageSize = Number(pageData.PageSize || pageSize || 50) || 50
      totalCount = pageData.TotalCount || pageData.totalCount || pageData.total || pageData.Total || 0
      totalPages = pageData.TotalPages || pageData.totalPages || (totalCount > 0 ? Math.ceil(totalCount / effectivePageSize) : 0)

      // Determine if there is a next page
      if (Array.isArray(pageTrades) && pageTrades.length === 0) {
        hasNextPage = false
      } else if (pageData.HasNextPage !== undefined) {
        hasNextPage = Boolean(pageData.HasNextPage)
      } else if (totalPages && currentPage < totalPages) {
        hasNextPage = true
      } else if (Array.isArray(pageTrades) && pageTrades.length < effectivePageSize) {
        hasNextPage = false
      } else {
        // Fallback: assume there might be more pages
        hasNextPage = true
      }
      
      logger.info(`Fetched page ${currentPage}: ${pageTrades.length} trades, hasNextPage: ${hasNextPage}`)
      
      // Move to next page
      currentPage++
      
      // Safety check to prevent infinite loops
      if (currentPage > 100) {
        logger.warn('Reached maximum page limit (100), stopping pagination')
        break
      }
    }
    
    logger.info(`Fetched total ${allTrades.length} trades from ${currentPage - 1} pages`)
    
    // Log sample trade structure if available
    if (allTrades.length > 0) {
      logger.info('Sample trade structure', {
        sample: allTrades[0],
        keys: Object.keys(allTrades[0]),
        totalTrades: allTrades.length
      })
    } else {
      logger.warn('No trades found in response', {
        pagesFetched: currentPage - 1,
        endpoint: baseUrl
      })
    }

    // Filter non-zero P/L trades if enabled
    const finalTrades = filterZeroProfit
      ? allTrades.filter((trade: any) => {
          const profit = trade.Profit ?? trade.profit ?? trade.PnL ?? trade.pnl ?? 0
          const n = Number(profit)
          return Number.isFinite(n) && n !== 0
        })
      : allTrades
    logger.info(
      filterZeroProfit
        ? `Filtered ${finalTrades.length} non-zero P/L trades from ${allTrades.length} total trades`
        : `Returning all ${finalTrades.length} trades (zero P/L included)`
    )

    if (finalTrades.length > 0) {
      logger.info('Sample filtered trade structure', { 
        sample: finalTrades[0],
        keys: Object.keys(finalTrades[0])
      })
    }

    // Return filtered trades with aggregated pagination info
    return NextResponse.json({
      success: true,
      data: finalTrades,
      pagination: {
        page: 1, // All data is now on one page
        pageSize: finalTrades.length,
        totalCount: finalTrades.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        originalTotalCount: totalCount,
        originalTotalPages: totalPages,
        pagesFetched: currentPage - 1
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
