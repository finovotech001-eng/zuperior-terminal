/**
 * Sync Symbols from MT5 API to Instrument Table
 * 
 * This script fetches all trading symbols from the MT5 API
 * and stores them in the Instrument table in the database.
 * 
 * Run: npx tsx scripts/sync-symbols-from-mt5.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

// Load environment variables from .env.local first, then .env
// Using process.cwd() to get the project root directory
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// MT5 API Configuration
const MT5_API_URL = 'http://18.175.242.21:5003/api';
const SYMBOLS_ENDPOINT = `${MT5_API_URL}/Symbols/categories`;

interface MT5Symbol {
  Symbol: string;
  Description: string;
  Path?: string;
  ISIN?: string;
  Sector?: string | number;
  Industry?: number;
  Country?: string;
  Currency?: string;
  BaseCurrency?: string;
  QuoteCurrency?: string;
  CurrencyProfit?: string;
  CurrencyMargin?: string;
  Category?: string;
  Digits: number;
  Point?: number;
  Multiply?: number;
  TickSize: number;
  TickValue?: number;
  ContractSize?: number;
  VolumeMin: number;
  VolumeMax: number;
  VolumeStep?: number;
  VolumeLimit?: number;
  MarginInitial?: number;
  MarginMaintenance?: number;
  TradeMode: number;
  TradeFlags?: number;
  CalcMode?: number;
  ExecMode?: number;
  Spread: number;
  SwapLong?: number;
  SwapShort?: number;
  SwapMode?: number;
}

interface MT5ApiResponse {
  Forex?: MT5Symbol[];
  Stocks?: MT5Symbol[];
  Crypto?: MT5Symbol[];
  Indices?: MT5Symbol[];
  Commodities?: MT5Symbol[];
  Metals?: MT5Symbol[];
  Energy?: MT5Symbol[];
  [key: string]: MT5Symbol[] | undefined;
}

// Determine category based on API Category field or Path
function determineCategory(category: string | undefined, path: string | undefined): string {
  // First try to use the Category field from API
  if (category) {
    const catLower = category.toLowerCase();
    if (catLower.includes('forex')) return 'forex';
    if (catLower.includes('stock')) return 'stocks';
    if (catLower.includes('crypto')) return 'crypto';
    if (catLower.includes('index') || catLower.includes('indices')) return 'indices';
    if (catLower.includes('commodit')) return 'commodities';
    if (catLower.includes('metal')) return 'metals';
    if (catLower.includes('energ')) return 'energy';
  }
  
  // Fallback to Path if Category not available
  if (path) {
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
    }
  }
  
  return 'other';
}

// Extract group from Path
function extractGroup(path: string | undefined): string {
  if (!path) return 'Default';
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
    
    // Flatten all categories into a single array
    const allSymbols: MT5Symbol[] = [];
    let totalCount = 0;
    
    for (const category in data) {
      if (Array.isArray(data[category])) {
        const categorySymbols = data[category] as MT5Symbol[];
        allSymbols.push(...categorySymbols);
        totalCount += categorySymbols.length;
      }
    }
    
    console.log(`✅ Fetched ${totalCount} symbols from MT5 API (${Object.keys(data).length} categories)`);
    
    return allSymbols;
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

      const category = determineCategory(symbol.Category, symbol.Path);
      const group = extractGroup(symbol.Path);

      // Prepare instrument data
      const instrumentData = {
        symbol: symbol.Symbol,
        name: symbol.Description || symbol.Symbol,
        description: symbol.Description || symbol.Symbol,
        category: category,
        group: group,
        digits: symbol.Digits,
        contractSize: symbol.ContractSize || 1,
        minVolume: convertVolume(symbol.VolumeMin),
        maxVolume: convertVolume(symbol.VolumeMax),
        volumeStep: convertVolume(symbol.VolumeStep || 100),
        spread: symbol.Spread,
        isActive: symbol.TradeMode === 4, // TradeMode 4 = Full Access
        tradingHours: JSON.stringify({
          swapLong: symbol.SwapLong || 0,
          swapShort: symbol.SwapShort || 0,
          swapMode: symbol.SwapMode || 0,
          currency: symbol.Currency || symbol.BaseCurrency || '',
          baseCurrency: symbol.BaseCurrency || '',
          quoteCurrency: symbol.QuoteCurrency || '',
          currencyProfit: symbol.CurrencyProfit || '',
          currencyMargin: symbol.CurrencyMargin || '',
          country: symbol.Country || '',
          isin: symbol.ISIN || '',
          sector: symbol.Sector || '',
          industry: symbol.Industry || 0,
          tickSize: symbol.TickSize,
          tickValue: symbol.TickValue || 0,
        }),
        lastUpdated: new Date(),
        updatedAt: new Date(),
      };

      // Upsert (create or update) the instrument
      await prisma.instrument.upsert({
        where: { symbol: symbol.Symbol },
        update: instrumentData,
        create: {
          ...instrumentData,
          id: randomUUID(), // Generate UUID for new instruments
        },
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


