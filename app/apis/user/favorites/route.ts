import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXT_PUBLIC_JWT_SECRET || 'dev-secret'
)

/**
 * Get user ID from JWT token
 */
async function getUserIdFromToken(request: NextRequest): Promise<string | null> {
  try {
    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('token')?.value

    if (!token) return null

    const { payload } = await jwtVerify(token, SECRET)
    return payload.userId as string || null
  } catch {
    return null
  }
}

/**
 * GET /apis/user/favorites
 * Get user's favorite instruments
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromToken(request)

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch favorites from database
    const favorites = await prisma.userFavorite.findMany({
      where: { userId },
      include: {
        instrument: {
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
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const transformedFavorites = favorites.map(fav => ({
      ...fav.instrument,
      favoriteId: fav.id,
      sortOrder: fav.sortOrder,
      addedAt: fav.addedAt,
      isFavorite: true,
    }))

    logger.info('User favorites fetched', { userId, count: favorites.length })

    return NextResponse.json({
      success: true,
      data: transformedFavorites,
    })
  } catch (error) {
    logger.error('Failed to fetch user favorites', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /apis/user/favorites
 * Add instrument to user's favorites
 * Body: { instrumentId: string, sortOrder?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromToken(request)

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { instrumentId, sortOrder } = body

    if (!instrumentId) {
      return NextResponse.json(
        { success: false, message: 'instrumentId is required' },
        { status: 400 }
      )
    }

    // Check if instrument exists
    const instrument = await prisma.instrument.findUnique({
      where: { id: instrumentId },
    })

    if (!instrument) {
      return NextResponse.json(
        { success: false, message: 'Instrument not found' },
        { status: 404 }
      )
    }

    // Check if already favorited
    const existing = await prisma.userFavorite.findUnique({
      where: {
        userId_instrumentId: {
          userId,
          instrumentId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Instrument already in favorites' },
        { status: 409 }
      )
    }

    // Get next sort order if not provided
    let finalSortOrder = sortOrder
    if (finalSortOrder === undefined) {
      const maxSortOrder = await prisma.userFavorite.findFirst({
        where: { userId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
      finalSortOrder = (maxSortOrder?.sortOrder || 0) + 1
    }

    // Add to favorites
    const favorite = await prisma.userFavorite.create({
      data: {
        userId,
        instrumentId,
        sortOrder: finalSortOrder,
      },
      include: {
        instrument: true,
      },
    })

    logger.info('Instrument added to favorites', {
      userId,
      instrumentId,
      symbol: instrument.symbol,
    })

    return NextResponse.json({
      success: true,
      message: 'Added to favorites',
      data: {
        ...favorite.instrument,
        favoriteId: favorite.id,
        sortOrder: favorite.sortOrder,
        addedAt: favorite.addedAt,
        isFavorite: true,
      },
    })
  } catch (error) {
    logger.error('Failed to add favorite', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /apis/user/favorites
 * Remove instrument from user's favorites
 * Body: { instrumentId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromToken(request)

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { instrumentId } = body

    if (!instrumentId) {
      return NextResponse.json(
        { success: false, message: 'instrumentId is required' },
        { status: 400 }
      )
    }

    // Delete favorite
    const deleted = await prisma.userFavorite.deleteMany({
      where: {
        userId,
        instrumentId,
      },
    })

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, message: 'Favorite not found' },
        { status: 404 }
      )
    }

    logger.info('Instrument removed from favorites', {
      userId,
      instrumentId,
    })

    return NextResponse.json({
      success: true,
      message: 'Removed from favorites',
    })
  } catch (error) {
    logger.error('Failed to remove favorite', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /apis/user/favorites
 * Update favorites sort order
 * Body: { favorites: Array<{ instrumentId: string, sortOrder: number }> }
 */
export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserIdFromToken(request)

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { favorites } = body

    if (!Array.isArray(favorites)) {
      return NextResponse.json(
        { success: false, message: 'favorites must be an array' },
        { status: 400 }
      )
    }

    // Update sort order for each favorite
    await Promise.all(
      favorites.map(fav =>
        prisma.userFavorite.updateMany({
          where: {
            userId,
            instrumentId: fav.instrumentId,
          },
          data: {
            sortOrder: fav.sortOrder,
          },
        })
      )
    )

    logger.info('Favorites order updated', { userId, count: favorites.length })

    return NextResponse.json({
      success: true,
      message: 'Favorites order updated',
    })
  } catch (error) {
    logger.error('Failed to update favorites order', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

