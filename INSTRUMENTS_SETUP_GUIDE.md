# Instruments & Favorites - Setup Guide

This guide explains how to set up and use the new database-backed instruments system with user favorites.

---

## Overview

The new system:
- ✅ **Stores instruments in database** instead of calling external API on every refresh
- ✅ **User favorites** - Each user can favorite instruments
- ✅ **Fast loading** - Favorites shown first
- ✅ **Filtering** - By category, search, etc.
- ✅ **Redis caching** - 5-minute cache for ultra-fast responses
- ✅ **Sync system** - One-time sync from external API to database

---

## Database Schema

### Instruments Table

```prisma
model Instrument {
  id                String             @id @default(uuid())
  symbol            String             @unique // e.g., "EUR/USD", "BTCUSD"
  name              String?            // Full name if available
  description       String?            // Description from API
  category          String             // forex, crypto, stocks, indices, commodities
  group             String?            // Group/Category from MT5 API
  digits            Int                @default(5) // Decimal places
  contractSize      Float              @default(100000) // Standard lot size
  minVolume         Float              @default(0.01) // Minimum trade volume
  maxVolume         Float              @default(100) // Maximum trade volume
  volumeStep        Float              @default(0.01) // Volume step
  spread            Float              @default(0) // Current spread
  isActive          Boolean            @default(true) // Trading enabled/disabled
  tradingHours      String?            // Trading hours if available
  lastUpdated       DateTime           @updatedAt
  createdAt         DateTime           @default(now())
  
  userFavorites     UserFavorite[]
}
```

### User Favorites Table

```prisma
model UserFavorite {
  id                String      @id @default(uuid())
  userId            String
  user              User        @relation(fields: [userId], references: [id])
  instrumentId      String
  instrument        Instrument  @relation(fields: [instrumentId], references: [id])
  sortOrder         Int         @default(0) // Custom sort order for user
  addedAt           DateTime    @default(now())
  
  @@unique([userId, instrumentId]) // User can only favorite once
}
```

---

## Setup Instructions

### Step 1: Run Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Run migration
npx prisma migrate dev --name add_instruments_and_favorites

# Or for production
npx prisma migrate deploy
```

### Step 2: Initial Sync (First Time Only)

You need to sync instruments from the external API to your database. This should be done:
- **Once** on first setup
- **Periodically** (daily/weekly) to update the instrument list
- **Manually** when needed by admin

#### Option 1: Using API Endpoint (Recommended)

```bash
# Get your authentication token first
# Then call the sync endpoint

curl -X POST http://localhost:3000/apis/instruments/sync \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Instruments synced successfully",
  "stats": {
    "total": 1250,
    "created": 1250,
    "updated": 0,
    "errors": 0,
    "duration": "2345ms"
  }
}
```

#### Option 2: Using Script (For Automation)

Create a script: `scripts/sync-instruments.ts`

```typescript
import { prisma } from '../lib/prisma'

async function syncInstruments() {
  const response = await fetch('http://localhost:3000/apis/instruments/sync', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_ADMIN_TOKEN',
      'Content-Type': 'application/json',
    },
  })

  const result = await response.json()
  console.log('Sync result:', result)
}

syncInstruments()
  .then(() => console.log('Done'))
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Run it:
```bash
npx ts-node scripts/sync-instruments.ts
```

### Step 3: Verify Sync

```bash
# Check sync status
curl http://localhost:3000/apis/instruments/sync

# Response:
{
  "success": true,
  "data": {
    "totalInstruments": 1250,
    "activeInstruments": 1200,
    "lastSyncAt": "2025-10-24T10:30:00.000Z",
    "needsSync": false,
    "categories": [
      { "category": "forex", "count": 450 },
      { "category": "crypto", "count": 200 },
      { "category": "stocks", "count": 300 },
      { "category": "indices", "count": 150 },
      { "category": "commodities", "count": 150 }
    ]
  }
}
```

---

## API Endpoints

### 1. Sync Instruments

**POST** `/apis/instruments/sync`

Sync instruments from external API to database.

**Headers:**
- `Authorization: Bearer <token>` (Admin only)

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 1250,
    "created": 1250,
    "updated": 0,
    "errors": 0
  }
}
```

---

### 2. Get Sync Status

**GET** `/apis/instruments/sync`

Get current sync status.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalInstruments": 1250,
    "lastSyncAt": "2025-10-24T10:30:00Z",
    "needsSync": false
  }
}
```

---

### 3. Get Instruments

**GET** `/apis/instruments`

Fetch instruments from database with filters.

**Query Parameters:**
- `category`: forex|crypto|stocks|indices|commodities|all (default: all)
- `search`: Search term
- `offset`: Pagination offset (default: 0)
- `limit`: Page size (default: 100, max: 1000)
- `activeOnly`: true|false (default: true)
- `userId`: Include favorites for user

**Example:**
```bash
curl "http://localhost:3000/apis/instruments?category=forex&limit=50"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "123",
      "symbol": "EUR/USD",
      "description": "Euro vs US Dollar",
      "category": "forex",
      "group": "Major Pairs",
      "isFavorite": false
    }
  ],
  "total": 450,
  "offset": 0,
  "limit": 50
}
```

---

### 4. Get Market Data (Updated)

**GET** `/apis/market-data`

Now fetches from database instead of external API!

**Query Parameters:**
- Same as `/apis/instruments`

**Example:**
```bash
curl "http://localhost:3000/apis/market-data?category=crypto&offset=0&limit=100"
```

---

### 5. Get User Favorites

**GET** `/apis/user/favorites`

Get current user's favorite instruments.

**Headers:**
- `Authorization: Bearer <token>` (Required)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "123",
      "symbol": "EUR/USD",
      "category": "forex",
      "isFavorite": true,
      "sortOrder": 0,
      "addedAt": "2025-10-24T10:00:00Z"
    }
  ]
}
```

---

### 6. Add Favorite

**POST** `/apis/user/favorites`

Add instrument to favorites.

**Headers:**
- `Authorization: Bearer <token>` (Required)

**Body:**
```json
{
  "instrumentId": "123",
  "sortOrder": 0  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Added to favorites",
  "data": { ... }
}
```

---

### 7. Remove Favorite

**DELETE** `/apis/user/favorites`

Remove instrument from favorites.

**Headers:**
- `Authorization: Bearer <token>` (Required)

**Body:**
```json
{
  "instrumentId": "123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Removed from favorites"
}
```

---

### 8. Reorder Favorites

**PATCH** `/apis/user/favorites`

Update sort order of favorites.

**Headers:**
- `Authorization: Bearer <token>` (Required)

**Body:**
```json
{
  "favorites": [
    { "instrumentId": "123", "sortOrder": 0 },
    { "instrumentId": "456", "sortOrder": 1 },
    { "instrumentId": "789", "sortOrder": 2 }
  ]
}
```

---

## Frontend Usage

### Using React Hooks

```typescript
import { useInstrumentsWithFavorites } from '@/hooks/useInstruments'

function InstrumentList() {
  const userId = 'user-123' // Get from auth
  
  const {
    instruments,        // All instruments with favorites first
    favorites,          // Just favorites
    isLoading,
    error,
    needsSync,         // True if database is empty
    toggleFavorite,    // Add/remove favorite
    refetch,           // Reload data
  } = useInstrumentsWithFavorites(userId, {
    category: 'forex',
    limit: 100,
  })

  if (needsSync) {
    return <div>Database needs sync. Contact admin.</div>
  }

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h2>Favorites ({favorites.length})</h2>
      {favorites.map(inst => (
        <div key={inst.id}>
          {inst.symbol}
          <button onClick={() => toggleFavorite(inst.id, true)}>
            Remove
          </button>
        </div>
      ))}

      <h2>All Instruments</h2>
      {instruments.map(inst => (
        <div key={inst.id}>
          {inst.symbol}
          <button onClick={() => toggleFavorite(inst.id, inst.isFavorite)}>
            {inst.isFavorite ? 'Unfavorite' : 'Favorite'}
          </button>
        </div>
      ))}
    </div>
  )
}
```

---

## Periodic Sync (Recommended)

Set up a cron job to sync instruments periodically:

### Using Node-cron

```typescript
import cron from 'node-cron'

// Sync every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily instrument sync...')
  
  try {
    const response = await fetch('http://localhost:3000/apis/instruments/sync', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ADMIN_TOKEN',
      },
    })
    
    const result = await response.json()
    console.log('Sync completed:', result)
  } catch (error) {
    console.error('Sync failed:', error)
  }
})
```

### Using System Cron

```bash
# Add to crontab
crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * curl -X POST http://localhost:3000/apis/instruments/sync \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## Performance Benefits

### Before (External API every time)
- **Load time:** 2-3 seconds
- **Server load:** High (constant API calls)
- **API costs:** Expensive
- **Reliability:** Depends on external API
- **Favorites:** Not possible

### After (Database with caching)
- **Load time:** <100ms (from cache)
- **Server load:** Low (cached responses)
- **API costs:** Minimal (one sync per day)
- **Reliability:** High (independent of external API)
- **Favorites:** ✅ Fully supported

---

## Troubleshooting

### Issue: "No instruments available"

**Solution:** Run initial sync

```bash
curl -X POST http://localhost:3000/apis/instruments/sync \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Issue: Favorites not showing

**Solution:** Check user authentication

```typescript
// Make sure userId is passed correctly
const { favorites } = useFavorites(userId)
```

### Issue: Slow loading

**Solution:** Check Redis connection

```bash
# Test Redis
redis-cli ping
# Should return: PONG
```

---

## Migration from Old System

If you're migrating from the old system:

1. **Run database migration** - Creates new tables
2. **Run initial sync** - Populates instruments
3. **Update frontend code** - Use new hooks
4. **Test thoroughly** - Verify favorites work
5. **Deploy** - Roll out to production

---

**Last Updated:** October 24, 2025  
**Version:** 1.0  
**Status:** Production Ready

