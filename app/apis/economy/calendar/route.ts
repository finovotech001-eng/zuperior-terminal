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
 * GET /apis/economy/calendar
 * Get economic calendar events from external API using AccountId and client bearer token
 */
export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const country = searchParams.get('country')
    const category = searchParams.get('category')
    const importance = searchParams.get('importance')
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')
    const limit = searchParams.get('limit')

    // Validate AccountId
    if (!accountId) {
      return NextResponse.json(
        { success: false, message: 'AccountId is required' },
        { status: 400 }
      )
    }

    // Build query string (excluding accountId as it will be sent as header)
    const queryParams = new URLSearchParams()
    if (country) queryParams.append('country', country)
    if (category) queryParams.append('category', category)
    if (importance) queryParams.append('importance', importance)
    if (fromDate) queryParams.append('fromDate', fromDate)
    if (toDate) queryParams.append('toDate', toDate)
    if (limit) queryParams.append('limit', limit)

    const queryString = queryParams.toString()
    const economyApiUrl = `${API_BASE_URL}/api/economy/calendar${queryString ? '?' + queryString : ''}`

    // Get client access token using AccountId
    const { token: accessToken, accountId: verifiedAccountId, error: tokenError } = await getClientToken(accountId)
    if (!accessToken || !verifiedAccountId) {
      return NextResponse.json(
        { success: false, message: tokenError || 'Failed to get authentication token' },
        { status: 503 }
      )
    }

    // Fetch economic calendar from external API with AccountId header and bearer token
    logger.info('Fetching economic calendar from external API', { 
      url: economyApiUrl, 
      accountId: verifiedAccountId,
      headers: {
        Authorization: 'Bearer ***',
        AccountId: verifiedAccountId,
      }
    })
    
    const calendarResponse = await fetch(economyApiUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'AccountId': verifiedAccountId,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    // Log response status and headers for debugging

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text().catch(() => 'No response body')
      logger.error('Failed to fetch economic calendar', { 
        status: calendarResponse.status,
        error: errorText.substring(0, 500),
        url: economyApiUrl
      })
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to fetch economic calendar from external API',
          error: errorText.substring(0, 200),
          status: calendarResponse.status
        },
        { status: calendarResponse.status }
      )
    }

    // Get raw response text first for debugging
    const responseText = await calendarResponse.text()
    logger.info('Economic calendar API raw response', {
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
    logger.info('Economic calendar API parsed response', {
      type: typeof data,
      isArray: Array.isArray(data),
      keys: data && typeof data === 'object' ? Object.keys(data) : null,
      dataLength: Array.isArray(data) ? data.length : 'N/A',
      sample: Array.isArray(data) && data.length > 0 ? data[0] : data
    })

    // Handle different response formats from the external API
    let events = []
    if (Array.isArray(data)) {
      events = data
      logger.info(`Found direct array with ${events.length} events`)
    } else if (data && typeof data === 'object') {
      // Try various common response formats
      events = data.Data || data.data || data.events || data.items || data.Items || []
      logger.info(`Extracted events from object: ${events.length}`, {
        source: data.Data ? 'Data' : 
                data.data ? 'data' : 
                data.events ? 'events' : 
                data.items ? 'items' : 
                data.Items ? 'Items' : 'none'
      })
      // If still not an array, wrap it
      if (!Array.isArray(events)) {
        logger.warn('Events is not an array', { events, type: typeof events })
        events = []
      }
    } else {
      logger.warn('Unexpected response format', { data, type: typeof data })
    }

    logger.info(`Fetched ${events.length} economic calendar events from external API`)
    
    // Log sample event if available
    if (events.length > 0) {
      logger.info('Sample event structure', { 
        sample: events[0],
        keys: Object.keys(events[0])
      })
    }

    // Return in a consistent format
    return NextResponse.json({
      success: true,
      data: events,
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
  } catch (error) {
    logger.error('Economic calendar fetch failed', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

