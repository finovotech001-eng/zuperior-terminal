import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { checkRateLimit, getIdentifier, rateLimiters } from '@/lib/rate-limit'

/**
 * GET /apis/instruments
 * Fetch instruments from database with filtering and pagination
 * 
 * Query Parameters:
 * - category: forex|crypto|stocks|indices|commodities|all (default: all)
 * - search: Search term for symbol/name
 * - offset: Pagination offset (default: 0)
 * - limit: Pagination limit (default: 100, max: 1000)
 * - activeOnly: true|false (default: true)
 * - userId: Include user favorites (requires auth)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Rate limiting
    const identifier = getIdentifier(request)
    const rateLimit = await checkRateLimit(identifier, rateLimiters.generous)

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Too many requests',
          retryAfter: rateLimit.reset,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimit.limit.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.reset.toString(),
          },
        }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || 'all'
    const search = searchParams.get('search') || ''
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000)
    const activeOnly = searchParams.get('activeOnly') !== 'false'
    const userId = searchParams.get('userId') // Optional: for including favorites

    // Build where clause
    const where: {
      isActive?: boolean
      category?: string
      OR?: Array<{ symbol?: { contains: string; mode: 'insensitive' } }>
    } = {}

    if (activeOnly) {
      where.isActive = true
    }

    if (category !== 'all') {
      where.category = category
    }

    if (search) {
      where.OR = [
        { symbol: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Fetch instruments from database
    const [instruments, total] = await Promise.all([
      prisma.instrument.findMany({
        where,
        select: {
          id: true,
          symbol: true,
          name: true,
          description: true,
          category: true,
          group: true,
          digits: true,
          contractSize: true,
          minVolume: true,
          maxVolume: true,
          volumeStep: true,
          spread: true,
          isActive: true,
          // Include user favorites if userId provided
          ...(userId && {
            userFavorites: {
              where: { userId },
              select: { sortOrder: true },
            },
          }),
        },
        orderBy: [
          { category: 'asc' },
          { symbol: 'asc' },
        ],
        skip: offset,
        take: limit,
      }),
      prisma.instrument.count({ where }),
    ])

    // Transform data to include isFavorite flag
    const transformedInstruments = instruments.map(inst => ({
      id: inst.id,
      symbol: inst.symbol,
      name: inst.name || inst.symbol,
      description: inst.description || inst.symbol,
      category: inst.category,
      group: inst.group,
      digits: inst.digits,
      contractSize: inst.contractSize,
      minVolume: inst.minVolume,
      maxVolume: inst.maxVolume,
      volumeStep: inst.volumeStep,
      spread: inst.spread,
      isActive: inst.isActive,
      isFavorite: userId ? (inst.userFavorites && inst.userFavorites.length > 0) : false,
      sortOrder: userId && inst.userFavorites?.[0]?.sortOrder || 0,
    }))

    const duration = Date.now() - startTime

    logger.info('Instruments fetched from database', {
      category,
      search,
      offset,
      limit,
      total,
      duration: `${duration}ms`,
    })

    return NextResponse.json({
      success: true,
      data: transformedInstruments,
      total,
      offset,
      limit,
      responseTime: `${duration}ms`,
    })
  } catch (error) {
    logger.error('Failed to fetch instruments', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

