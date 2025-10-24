import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Generate mock prices for instruments
 * TODO: Replace with real-time price feed
 */
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

/**
 * GET /apis/market-data
 * Fetches instrument data from database with pagination and filtering
 * 
 * Query Parameters:
 * - offset: Pagination offset (default: 0)
 * - limit: Items per page (default: 100)
 * - category: Filter by category (forex, crypto, stocks, indices, commodities, all)
 * - userId: Include favorite status for user
 */
export async function GET(request: Request) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const category = searchParams.get('category') || 'all';
  const userId = searchParams.get('userId'); // For favorites

  try {
    // Check if we have instruments in database
    const instrumentCount = await prisma.instrument.count();

    if (instrumentCount === 0) {
      logger.warn('No instruments in database, needs sync');
      return NextResponse.json(
        {
          success: false,
          message: 'No instruments available. Please run sync first.',
          needsSync: true,
        },
        { status: 503 }
      );
    }

    // Build where clause
    const where: {
      isActive: boolean;
      category?: string;
    } = {
      isActive: true,
    };

    if (category !== 'all') {
      where.category = category;
    }

    // Fetch from database
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
          spread: true,
          ...(userId && {
            userFavorites: {
              where: { userId },
              select: { sortOrder: true, addedAt: true },
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
    ]);

    // Generate mock prices (will be replaced with real-time data later)
    const instrumentsWithPrices = instruments.map(inst => {
      const mockPrices = generateMockPrice(inst.category);
      return {
        id: inst.id,
        symbol: inst.symbol,
        description: inst.description || inst.name || inst.symbol,
        category: inst.category,
        group: inst.group,
        signal: mockPrices.change1d > 0 ? ('up' as const) : ('down' as const),
        bid: mockPrices.bid,
        ask: mockPrices.ask,
        change1d: mockPrices.change1d,
        changePercent1d: mockPrices.changePercent1d,
        isFavorite: userId ? (inst.userFavorites && inst.userFavorites.length > 0) : false,
      };
    });

    const duration = Date.now() - startTime;

    // Only log if it's slow or first/last chunk
    if (duration > 500 || offset === 0) {
      logger.info('Market data fetched from database', {
        category,
        offset,
        limit,
        total,
        duration: `${duration}ms`,
      });
    }

    return NextResponse.json({
      success: true,
      data: instrumentsWithPrices,
      total,
      offset,
      limit,
      responseTime: `${duration}ms`,
    });
  } catch (error) {
    logger.error('Market data fetch failed', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
