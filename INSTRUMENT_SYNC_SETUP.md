# Instrument Sync & Default Favorites Setup

## Overview

Successfully synced 858 instruments from the MT5 API endpoint (`http://18.130.5.209:5003/api/Symbols`) and configured default favorites for all users.

## What Was Done

### 1. Synced Instruments from API
- **Total Instruments**: 858
- **API Endpoint**: `http://18.130.5.209:5003/api/Symbols`
- **Categories**:
  - Forex: 176 instruments
  - Crypto: 63 instruments
  - Indices: 39 instruments
  - Commodities: 26 instruments
  - Stocks: 554 instruments

### 2. Set Default Favorites
The following symbols have been set as default favorites for all users:
- **EURUSD** (Forex)
- **XAUUSD** (Commodities - Gold)
- **BTCUSD** (Crypto)
- **GBPJPY** (Forex)

### 3. Users Affected
All 7 users in the database now have these 4 symbols as their default favorites.

## Files Created/Modified

### Created Files
1. `scripts/sync-instruments-from-api.ts` - Main sync script that fetches from API, syncs to database, and sets favorites
2. `scripts/verify-setup.ts` - Verification script to check database state
3. `INSTRUMENT_SYNC_SETUP.md` - This documentation file

### Modified Files
1. `lib/default-favorites.ts` - Updated to use EURUSD, XAUUSD, BTCUSD, GBPJPY
2. `scripts/add-default-favorites.ts` - Updated to use EURUSD, XAUUSD, BTCUSD, GBPJPY
3. `package.json` - Added new npm scripts

## How to Use

### Sync Instruments from API
```bash
cd zuperior-terminal
npm run sync:instruments:api
```

This command will:
1. Fetch all instruments from `http://18.130.5.209:5003/api/Symbols`
2. Sync them to your database (create or update)
3. Add default favorites to all users

### Verify Setup
```bash
npm run verify:setup
```

This will show:
- Total instruments count
- Breakdown by category
- Required symbols status
- User favorites

### Add/Update Favorites Manually
```bash
npm run sync:favorites
```

This will add default favorites to users who don't have any yet.

## Database Schema

### Instrument Model
```prisma
model Instrument {
  id           String        @id @default(uuid())
  symbol       String        @unique
  name         String?
  description  String?
  category     String
  group        String?
  digits       Int           @default(5)
  contractSize Float         @default(100000)
  minVolume    Float         @default(0.01)
  maxVolume    Float         @default(100)
  volumeStep   Float         @default(0.01)
  spread       Float         @default(0)
  isActive     Boolean       @default(true)
  tradingHours String?
  lastUpdated  DateTime      @updatedAt
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  userFavorites UserFavorite[]
}
```

### UserFavorite Model
```prisma
model UserFavorite {
  id           String     @id @default(uuid())
  userId       String
  instrumentId String
  sortOrder    Int        @default(0)
  addedAt      DateTime   @default(now())
  user         User       @relation("userFavorites", fields: [userId], references: [id])
  instrument   Instrument @relation("userFavorites", fields: [instrumentId], references: [id])

  @@unique([userId, instrumentId])
  @@index([userId])
  @@index([instrumentId])
}
```

## Next Steps

1. **Regular Sync**: Run `npm run sync:instruments:api` periodically to keep instruments updated
2. **New Users**: Default favorites will be automatically added when new users register (via `ensureDefaultFavorites()`)
3. **Manual Updates**: Users can add/remove favorites through the UI

## API Integration Notes

The sync script handles:
- **Upsert operations**: Creates new instruments or updates existing ones
- **Category detection**: Automatically categorizes instruments based on Path/Symbol
- **Duplicate prevention**: Uses unique constraint on symbol
- **Error handling**: Continues processing even if individual instruments fail

## Troubleshooting

If instruments don't sync:
1. Check API endpoint is accessible: `curl http://18.130.5.209:5003/api/Symbols`
2. Verify database connection in `.env` file
3. Run `npm run verify:setup` to check current state
4. Check Prisma Studio: `npm run db:studio`

## Customization

To change default favorites, edit:
- `lib/default-favorites.ts` - For runtime default favorites
- `scripts/add-default-favorites.ts` - For the manual script
- `scripts/sync-instruments-from-api.ts` - For the sync script

To change API endpoint, edit:
- `scripts/sync-instruments-from-api.ts` - Update `API_URL` constant

