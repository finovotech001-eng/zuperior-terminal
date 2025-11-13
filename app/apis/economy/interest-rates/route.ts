import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const LIVE_API_URL = process.env.LIVE_API_URL || 'https://metaapi.zuperior.com/api'

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
 * GET /apis/economy/interest-rates
 * Get interest rates from external API using AccountId and client bearer token
 */
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const country = searchParams.get('country')
    const bank = searchParams.get('bank')
    const limit = searchParams.get('limit')

    // Validate AccountId
    if (!accountId) {
      return NextResponse.json(
        { success: false, message: 'AccountId is required' },
        { status: 400 }
      )
    }

    // Build query string
    const queryParams = new URLSearchParams()
    if (country) queryParams.append('country', country)
    if (bank) queryParams.append('bank', bank)
    if (limit) queryParams.append('limit', limit || '20')

    const queryString = queryParams.toString()
    const interestRatesApiUrl = `${API_BASE_URL}/api/economy/interest-rates${queryString ? '?' + queryString : ''}`

    // Get client access token using AccountId
    const { token: accessToken, accountId: verifiedAccountId, error: tokenError } = await getClientToken(accountId)
    if (!accessToken || !verifiedAccountId) {
      return NextResponse.json(
        { success: false, message: tokenError || 'Failed to get authentication token' },
        { status: 503 }
      )
    }

    // Fetch interest rates from external API with AccountId header and bearer token
    logger.info('Fetching interest rates from external API', { 
      url: interestRatesApiUrl, 
      accountId: verifiedAccountId,
      headers: {
        Authorization: 'Bearer ***',
        AccountId: verifiedAccountId,
      }
    })
    
    const interestRatesResponse = await fetch(interestRatesApiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'AccountId': verifiedAccountId,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    // Log response status and headers for debugging
    logger.info('Interest rates API response', {
      status: interestRatesResponse.status,
      statusText: interestRatesResponse.statusText,
      headers: Object.fromEntries(interestRatesResponse.headers.entries()),
    })

    if (!interestRatesResponse.ok) {
      const errorText = await interestRatesResponse.text().catch(() => 'No response body')
      logger.error('Failed to fetch interest rates', { 
        status: interestRatesResponse.status,
        error: errorText.substring(0, 500),
        url: interestRatesApiUrl
      })
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to fetch interest rates from external API',
          error: errorText.substring(0, 200),
          status: interestRatesResponse.status
        },
        { status: interestRatesResponse.status }
      )
    }

    // Get raw response text first for debugging
    const responseText = await interestRatesResponse.text()
    logger.info('Interest rates API raw response', {
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
    logger.info('Interest rates API parsed response', {
      type: typeof data,
      isArray: Array.isArray(data),
      keys: data && typeof data === 'object' ? Object.keys(data) : null,
      dataLength: Array.isArray(data) ? data.length : 'N/A',
      sample: Array.isArray(data) && data.length > 0 ? data[0] : data
    })

    // Handle different response formats from the external API
    let interestRates = []
    if (Array.isArray(data)) {
      interestRates = data
      logger.info(`Found direct array with ${interestRates.length} interest rates`)
    } else if (data && typeof data === 'object') {
      // Try various common response formats
      interestRates = data.Data || data.data || data.interestRates || data.items || data.Items || []
      logger.info(`Extracted interest rates from object: ${interestRates.length}`, {
        source: data.Data ? 'Data' : 
                data.data ? 'data' : 
                data.interestRates ? 'interestRates' : 
                data.items ? 'items' : 
                data.Items ? 'Items' : 'none'
      })
      // If still not an array, wrap it
      if (!Array.isArray(interestRates)) {
        logger.warn('Interest rates is not an array', { interestRates, type: typeof interestRates })
        interestRates = []
      }
    } else {
      logger.warn('Unexpected response format', { data, type: typeof data })
    }

    logger.info(`Fetched ${interestRates.length} interest rates from external API`)
    
    // Log sample interest rate if available
    if (interestRates.length > 0) {
      logger.info('Sample interest rate structure', { 
        sample: interestRates[0],
        keys: Object.keys(interestRates[0])
      })
    }

    // Return in a consistent format
    return NextResponse.json({
      success: true,
      data: interestRates,
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
  } catch (error) {
    logger.error('Interest rates fetch failed', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

