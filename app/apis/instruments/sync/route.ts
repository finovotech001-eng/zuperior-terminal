import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const MARKET_DATA_SYMBOLS_PATH = process.env.MARKET_DATA_SYMBOLS_PATH
const MANAGER_USERNAME = process.env.MANAGER_USERNAME
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD
const MANAGER_SERVER_IP = process.env.MANAGER_SERVER_IP
const MANAGER_PORT = process.env.MANAGER_PORT
const MANAGER_LOGIN_PATH = process.env.MANAGER_LOGIN_PATH

/**
 * Get Master Token for API authentication
 */
async function getMasterToken(): Promise<{ token: string | null; error: string | null }> {
  if (!API_BASE_URL || !MANAGER_USERNAME || !MANAGER_PASSWORD || !MANAGER_LOGIN_PATH) {
    return { token: null, error: 'Missing environment variables.' }
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
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body.')
      logger.error('Manager login failed', new Error(errorText))
      return { token: null, error: `Manager login failed: ${response.status}` }
    }

    const data = await response.json()
    const token = data.Token || data.AccessToken || null

    if (!token) {
      return { token: null, error: 'No token in response' }
    }

    return { token, error: null }
  } catch (error) {
    logger.error('Master token fetch error', error)
    return { token: null, error: 'Network error' }
  }
}

/**
 * Determine category based on symbol
 */
function determineCategory(symbol: string): string {
  const lowerSymbol = symbol.toLowerCase()
  
  if (lowerSymbol.includes('/') && lowerSymbol.length <= 7) return 'forex'
  if (lowerSymbol.includes('usd') && lowerSymbol.length > 3) return 'crypto'
  if (lowerSymbol.startsWith('us') && lowerSymbol.length > 3) return 'indices'
  if (lowerSymbol.startsWith('x')) return 'commodities'
  
  return 'stocks'
}

/**
 * POST /apis/instruments/sync
 * Sync instruments from external API to database
 * This should be called:
 * 1. On first application setup
 * 2. Periodically (daily/weekly) to update instrument list
 * 3. Manually by admin when needed
 */
export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    logger.info('Starting instrument sync')

    // Check if this is an authorized request (admin only)
    // TODO: Add admin authentication check here
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get master token
    const { token: masterToken, error: tokenError } = await getMasterToken()
    if (!masterToken) {
      return NextResponse.json(
        { success: false, message: tokenError || 'Failed to get authentication token' },
        { status: 503 }
      )
    }

    // Fetch instruments from external API
    logger.info('Fetching instruments from external API')
    const instrumentsResponse = await fetch(`${API_BASE_URL}${MARKET_DATA_SYMBOLS_PATH}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${masterToken}`,
      },
    })

    if (!instrumentsResponse.ok) {
      logger.error('Failed to fetch instruments', new Error(`Status: ${instrumentsResponse.status}`))
      return NextResponse.json(
        { success: false, message: 'Failed to fetch instruments from external API' },
        { status: instrumentsResponse.status }
      )
    }

    let rawData = await instrumentsResponse.json()

    // Handle different response formats
    if (!Array.isArray(rawData)) {
      const dataArray = rawData.Data || rawData.Symbols || rawData.data
      if (Array.isArray(dataArray)) {
        rawData = dataArray
      } else {
        rawData = []
      }
    }

    logger.info(`Fetched ${rawData.length} instruments from API`)

    // Process and upsert instruments to database
    let created = 0
    let updated = 0
    let errors = 0

    for (const item of rawData) {
      try {
        const symbol = item.Symbol || item.Name || item.symbol
        if (!symbol) {
          errors++
          continue
        }

        const category = determineCategory(symbol)
        const group = item.Path || item.Group || item.group || category

        // Upsert instrument
        const result = await prisma.instrument.upsert({
          where: { symbol },
          update: {
            name: item.Name || item.name || symbol,
            description: item.Description || item.description || symbol,
            category,
            group,
            digits: item.Digits || item.digits || 5,
            contractSize: item.ContractSize || item.contractSize || 100000,
            minVolume: item.VolumeMin || item.volumeMin || 0.01,
            maxVolume: item.VolumeMax || item.volumeMax || 100,
            volumeStep: item.VolumeStep || item.volumeStep || 0.01,
            spread: item.Spread || item.spread || 0,
            isActive: item.TradeMode === 'FULL' || item.tradeMode === 'FULL' || true,
            tradingHours: item.Sessions || item.sessions || null,
            lastUpdated: new Date(),
          },
          create: {
            symbol,
            name: item.Name || item.name || symbol,
            description: item.Description || item.description || symbol,
            category,
            group,
            digits: item.Digits || item.digits || 5,
            contractSize: item.ContractSize || item.contractSize || 100000,
            minVolume: item.VolumeMin || item.volumeMin || 0.01,
            maxVolume: item.VolumeMax || item.volumeMax || 100,
            volumeStep: item.VolumeStep || item.volumeStep || 0.01,
            spread: item.Spread || item.spread || 0,
            isActive: item.TradeMode === 'FULL' || item.tradeMode === 'FULL' || true,
            tradingHours: item.Sessions || item.sessions || null,
          },
        })

        // Check if it was created or updated
        if (result.createdAt.getTime() === result.lastUpdated.getTime()) {
          created++
        } else {
          updated++
        }
      } catch (error) {
        logger.error(`Error processing instrument ${item.Symbol || 'unknown'}`, error)
        errors++
      }
    }

    const duration = Date.now() - startTime

    logger.info('Instrument sync completed', {
      created,
      updated,
      errors,
      total: rawData.length,
      duration: `${duration}ms`,
    })

    return NextResponse.json({
      success: true,
      message: 'Instruments synced successfully',
      stats: {
        total: rawData.length,
        created,
        updated,
        errors,
        duration: `${duration}ms`,
      },
    })
  } catch (error) {
    logger.error('Instrument sync failed', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /apis/instruments/sync
 * Get sync status and last sync time
 */
export async function GET() {
  try {
    const totalInstruments = await prisma.instrument.count()
    const activeInstruments = await prisma.instrument.count({
      where: { isActive: true },
    })

    // Get last updated instrument to determine last sync time
    const lastUpdated = await prisma.instrument.findFirst({
      orderBy: { lastUpdated: 'desc' },
      select: { lastUpdated: true },
    })

    // Get counts by category
    const categories = await prisma.instrument.groupBy({
      by: ['category'],
      _count: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        totalInstruments,
        activeInstruments,
        lastSyncAt: lastUpdated?.lastUpdated || null,
        needsSync: totalInstruments === 0,
        categories: categories.map(c => ({
          category: c.category,
          count: c._count,
        })),
      },
    })
  } catch (error) {
    logger.error('Failed to get sync status', error)
    return NextResponse.json(
      { success: false, message: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}

