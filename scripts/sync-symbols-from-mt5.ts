/**
 * Sync Symbols from MT5 API to Instrument Table
 * 
 * This script fetches all trading symbols from the MT5 API
 * and stores them in the Instrument table in the database.
 * 
 * Run: npx tsx scripts/sync-symbols-from-mt5.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// MT5 API Configuration
const MT5_API_URL = process.env.LIVE_API_URL || 'http://18.130.5.209:5003/api';
const SYMBOLS_ENDPOINT = `${MT5_API_URL}/Symbols`;

interface MT5Symbol {
  Symbol: string;
  Description: string;
  Path: string;
  ISIN: string;
  Sector: number;
  Industry: number;
  Country: string;
  Currency: string;
  CurrencyProfit: string;
  CurrencyMargin: string;
  Digits: number;
  Point: number;
  Multiply: number;
  TickSize: number;
  TickValue: number;
  ContractSize: number;
  VolumeMin: number;
  VolumeMax: number;
  VolumeStep: number;
  VolumeLimit: number;
  MarginInitial: number;
  MarginMaintenance: number;
  TradeMode: number;
  TradeFlags: number;
  CalcMode: number;
  ExecMode: number;
  Spread: number;
  SwapLong: number;
  SwapShort: number;
  SwapMode: number;
}

interface MT5ApiResponse {
  Symbols: MT5Symbol[];
  Count: number;
}

// Determine category based on Path
function determineCategory(path: string): string {
  const pathLower = path.toLowerCase();
  
  if (pathLower.includes('forex major') || pathLower.includes('forex minor') || pathLower.includes('forex exotic')) {
    return 'forex';
  } else if (pathLower.includes('stock')) {
    return 'stocks';
  } else if (pathLower.includes('crypto') || pathLower.includes('bitcoin') || pathLower.includes('ethereum')) {
    return 'crypto';
  } else if (pathLower.includes('indic') || pathLower.includes('index')) {
    return 'indices';
  } else if (pathLower.includes('commodit') || pathLower.includes('gold') || pathLower.includes('silver') || pathLower.includes('oil')) {
    return 'commodities';
  } else if (pathLower.includes('metal')) {
    return 'metals';
  } else if (pathLower.includes('energ')) {
    return 'energy';
  } else {
    return 'other';
  }
}

// Extract group from Path
function extractGroup(path: string): string {
  const parts = path.split('\\');
  // Return the second-to-last part (e.g., "Forex Major", "Stocks", etc.)
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || 'Default';
}

// Convert volume from MT5 format (e.g., 100 = 0.01 lots)
function convertVolume(mt5Volume: number): number {
  return mt5Volume / 10000; // MT5 uses 100 = 0.01, so 10000 = 1.0
}

async function fetchSymbolsFromMT5(): Promise<MT5Symbol[]> {
  try {
    console.log(`🔍 Fetching symbols from: ${SYMBOLS_ENDPOINT}`);
    
    const response = await fetch(SYMBOLS_ENDPOINT, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: MT5ApiResponse = await response.json();
    
    console.log(`✅ Fetched ${data.Count} symbols from MT5 API`);
    
    return data.Symbols || [];
  } catch (error) {
    console.error('❌ Error fetching symbols from MT5:', error);
    throw error;
  }
}

async function syncSymbolsToDatabase(symbols: MT5Symbol[]) {
  console.log(`\n📊 Starting database sync for ${symbols.length} symbols...`);
  
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const symbol of symbols) {
    try {
      // Skip symbols without a valid symbol name
      if (!symbol.Symbol || symbol.Symbol.trim() === '') {
        skipped++;
        continue;
      }

      const category = determineCategory(symbol.Path);
      const group = extractGroup(symbol.Path);

      // Prepare instrument data
      const instrumentData = {
        symbol: symbol.Symbol,
        name: symbol.Description || symbol.Symbol,
        description: symbol.Description || symbol.Symbol,
        category: category,
        group: group,
        digits: symbol.Digits,
        contractSize: symbol.ContractSize,
        minVolume: convertVolume(symbol.VolumeMin),
        maxVolume: convertVolume(symbol.VolumeMax),
        volumeStep: convertVolume(symbol.VolumeStep),
        spread: symbol.Spread,
        isActive: symbol.TradeMode === 4, // TradeMode 4 = Full Access
        tradingHours: JSON.stringify({
          swapLong: symbol.SwapLong,
          swapShort: symbol.SwapShort,
          swapMode: symbol.SwapMode,
          currency: symbol.Currency,
          currencyProfit: symbol.CurrencyProfit,
          currencyMargin: symbol.CurrencyMargin,
          country: symbol.Country,
          isin: symbol.ISIN,
          sector: symbol.Sector,
          industry: symbol.Industry,
          tickSize: symbol.TickSize,
          tickValue: symbol.TickValue,
        }),
      };

      // Upsert (create or update) the instrument
      await prisma.instrument.upsert({
        where: { symbol: symbol.Symbol },
        update: instrumentData,
        create: instrumentData,
      });

      // Check if it was an update or create
      const existing = await prisma.instrument.findUnique({
        where: { symbol: symbol.Symbol },
        select: { createdAt: true, updatedAt: true }
      });

      if (existing && existing.createdAt.getTime() === existing.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }

    } catch (error) {
      console.error(`❌ Error syncing symbol ${symbol.Symbol}:`, error);
      errors++;
    }
  }

  console.log('\n📈 Sync Statistics:');
  console.log(`   ✅ Created: ${created}`);
  console.log(`   🔄 Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📊 Total: ${symbols.length}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   MT5 Symbols Sync to Instrument Table            ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: Fetch symbols from MT5 API
    const symbols = await fetchSymbolsFromMT5();

    if (symbols.length === 0) {
      console.log('⚠️  No symbols found in MT5 API response');
      return;
    }

    // Step 2: Sync to database
    await syncSymbolsToDatabase(symbols);

    // Step 3: Verify sync
    const totalInstruments = await prisma.instrument.count();
    console.log(`\n✅ Database now contains ${totalInstruments} instruments`);

    // Step 4: Show category breakdown
    console.log('\n📊 Instruments by Category:');
    const categories = await prisma.instrument.groupBy({
      by: ['category'],
      _count: true,
      orderBy: {
        _count: {
          category: 'desc'
        }
      }
    });

    for (const cat of categories) {
      console.log(`   ${cat.category}: ${cat._count}`);
    }

    console.log('\n✅ Sync completed successfully!');
  } catch (error) {
    console.error('\n❌ Sync failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

