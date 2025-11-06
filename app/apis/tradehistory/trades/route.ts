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

    // Get page parameter for pagination
    const page = searchParams.get('page') || '1'
    
    // Build query string with accountId and page
    const tradesApiUrl = `http://18.175.242.21:5003/api/client/tradehistory/trades?accountId=${accountId}&page=${page}`

    // Get client access token using AccountId
    const { token: accessToken, accountId: verifiedAccountId, error: tokenError } = await getClientToken(accountId)
    if (!accessToken || !verifiedAccountId) {
      return NextResponse.json(
        { success: false, message: tokenError || 'Failed to get authentication token' },
        { status: 503 }
      )
    }

    // Fetch all pages of trade history
    let allTrades: any[] = []
    let currentPage = 1
    let hasNextPage = true
    let totalCount = 0
    let totalPages = 0
    
    while (hasNextPage) {
      const pageUrl = `http://18.175.242.21:5003/api/client/tradehistory/trades?accountId=${accountId}&page=${currentPage}`
      
      logger.info('Fetching trade history page from external API', { 
        url: pageUrl, 
        page: currentPage,
        accountId: verifiedAccountId,
        headers: {
          Authorization: 'Bearer ***',
          AccountId: verifiedAccountId,
        }
      })
      
      const tradesResponse = await fetch(pageUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'AccountId': verifiedAccountId,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      })
      
      if (!tradesResponse.ok) {
        const errorText = await tradesResponse.text().catch(() => 'No response body')
        logger.error('Failed to fetch trade history page', { 
          status: tradesResponse.status,
          error: errorText.substring(0, 500),
          url: pageUrl,
          page: currentPage
        })
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
      
      // Extract trades from this page
      let pageTrades = []
      if (Array.isArray(pageData)) {
        pageTrades = pageData
      } else if (pageData && typeof pageData === 'object') {
        pageTrades = pageData.Items || pageData.Data || pageData.data || pageData.trades || pageData.items || pageData.results || pageData.Results || []
      }
      
      // Add trades from this page to the collection
      allTrades = allTrades.concat(pageTrades)
      
      // Update pagination info
      totalCount = pageData.TotalCount || pageData.totalCount || pageData.total || pageData.Total || 0
      totalPages = pageData.TotalPages || pageData.totalPages || Math.ceil(totalCount / (pageData.PageSize || 50))
      hasNextPage = pageData.HasNextPage !== undefined ? pageData.HasNextPage : false
      
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

    // Filter trades to only include those with non-zero profit
    const tradesWithProfit = allTrades.filter((trade: any) => {
      const profit = trade.Profit ?? trade.profit ?? trade.PnL ?? trade.pnl ?? 0
      return Number(profit) !== 0 && !isNaN(Number(profit))
    })
    
    logger.info(`Filtered ${tradesWithProfit.length} trades with non-zero profit from ${allTrades.length} total trades`)
    
    if (tradesWithProfit.length > 0) {
      logger.info('Sample filtered trade structure', { 
        sample: tradesWithProfit[0],
        keys: Object.keys(tradesWithProfit[0])
      })
    }

    // Return filtered trades with aggregated pagination info
    return NextResponse.json({
      success: true,
      data: tradesWithProfit,
      pagination: {
        page: 1, // All data is now on one page
        pageSize: tradesWithProfit.length,
        totalCount: tradesWithProfit.length,
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

