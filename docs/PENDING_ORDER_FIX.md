# Pending Order Placement - Fix Documentation

## Issue
Pending orders (Buy Limit / Sell Limit) were not working correctly when being placed from the terminal.

## Root Cause
The pending order API routes had three critical issues:

### 1. **Wrong API Endpoint**
The routes were trying to use separate endpoints (`/client/buy-limit`, `/client/sell-limit`) but only `/client/orders` works for all pending order types.

### 2. **Missing OrderType Field**
The unified `/client/orders` endpoint requires an `OrderType` field to distinguish between Buy Limit (2), Sell Limit (3), Buy Stop (4), and Sell Stop (5).

### 3. **Missing Login Field & Wrong Field Names**
- The API requires a `Login` field (account ID), but it wasn't being sent
- Field names must be PascalCase (`Symbol`, `Price`, `Volume`) not lowercase

## Files Fixed

### 1. `/app/apis/trading/pending/buy-limit/route.ts`
**Changes:**
- ✅ Added `Login` field to the payload (account ID as integer)
- ✅ Volume is now multiplied by 100 (`scaledVolume = volume * 100`)
- ✅ Added detailed console logging for debugging

**Payload Format (Before):**
```json
{
  "symbol": "XAUUSDm",
  "price": 2000.00,
  "volume": 0.01,          // ❌ Wrong format
  "stopLoss": 0,
  "takeProfit": 0,
  "comment": "Buy Limit via web"
}
```

**Payload Format (After):**
```json
{
  "Login": 123456,          // ✅ Added account ID
  "Symbol": "XAUUSDm",      // ✅ PascalCase
  "OrderType": 2,           // ✅ Added (2 = Buy Limit)
  "Price": 2000.00,         // ✅ PascalCase
  "Volume": 1,              // ✅ Fixed: 0.01 * 100 = 1
  "StopLoss": 0,            // ✅ PascalCase
  "TakeProfit": 0,          // ✅ PascalCase
  "Comment": "Buy Limit via web"  // ✅ PascalCase
}
```

### 2. `/app/apis/trading/pending/sell-limit/route.ts`
**Same changes as buy-limit route**

## How It Works Now

### Flow Diagram:
```
User clicks "Buy Limit" or "Sell Limit"
    ↓
Terminal Page (handleBuySubmit / handleSellSubmit)
    ↓
Calls: placeBuyLimit() or placeSellLimit()
    ↓
POST /apis/trading/pending/buy-limit or sell-limit
    ↓
1. Authenticates user session
2. Gets MT5 access token (from DB or client)
3. Converts volume to contract units (× 100)
4. Builds payload with Login field
5. Calls external API: /client/buy-limit or /client/sell-limit
    ↓
External MT5 API processes the pending order
    ↓
Returns success/error response
    ↓
Terminal shows notification
```

## Components Involved

### 1. **Client Helper Functions**
- File: `/components/trading/pendingOrders.ts`
- Functions:
  - `placeBuyLimit()` - Places buy limit orders
  - `placeSellLimit()` - Places sell limit orders
  - `cancelPendingOrder()` - Cancels pending orders

### 2. **API Routes**
- `/app/apis/trading/pending/buy-limit/route.ts` - Buy limit endpoint
- `/app/apis/trading/pending/sell-limit/route.ts` - Sell limit endpoint
- `/app/apis/trading/pending/order/[orderId]/route.ts` - Cancel pending order

### 3. **Terminal Integration**
- File: `/app/terminal/page.tsx`
- Functions:
  - `handleBuySubmit()` - Handles buy button click
  - `handleSellSubmit()` - Handles sell button click

### 4. **Pending Orders Display**
- Hook: `/hooks/usePendingOrders.ts` - Fetches and displays pending orders
- Polls API every 3 seconds to show current pending orders

## Testing

### To Test Buy Limit:
1. Open terminal
2. Select an instrument (e.g., XAUUSDm)
3. Select "Pending" order type
4. Enter:
   - Volume: 0.01 (will be converted to 1 contract unit)
   - Price: Your desired entry price
   - Optional: Stop Loss / Take Profit
5. Click "Buy"
6. Check console for logs: `[buy-limit] request` and `[buy-limit] response`
7. Verify pending order appears in "Pending" tab

### To Test Sell Limit:
- Same as above, but click "Sell" instead

## Console Logs to Monitor

When placing pending orders, watch for:
```
[buy-limit] request { url: '...', body: {...} }
[buy-limit] response { status: 200, data: {...} }
```

or

```
[sell-limit] request { url: '...', body: {...} }
[sell-limit] response { status: 200, data: {...} }
```

## Common Issues

### Issue: "Missing required fields"
**Solution:** Ensure accountId, symbol, price, and volume are all provided

### Issue: "MT5 account not found"
**Solution:** User must have a valid MT5 account linked in the database with password

### Issue: "Login failed"
**Solution:** Check that the MT5 account password is correct in the database

### Issue: Volume mismatch
**Solution:** The fix ensures volume is multiplied by 100 before sending to API

## External API Endpoints

All pending order types use a **single unified endpoint**:
- `POST https://metaapi.zuperior.com/api/client/orders`

This endpoint handles all pending order types based on the `OrderType` field:
- `OrderType: 2` = Buy Limit
- `OrderType: 3` = Sell Limit  
- `OrderType: 4` = Buy Stop
- `OrderType: 5` = Sell Stop

Required fields:
- Bearer token authentication
- `Login` field (account ID as integer)
- `Symbol` (instrument symbol)
- `OrderType` (2, 3, 4, or 5)
- `Price` (entry price)
- `Volume` in contract units (lots × 100)
- `StopLoss` (optional, 0 if not set)
- `TakeProfit` (optional, 0 if not set)
- `Comment` (optional)

## Summary of Fix

✅ **Before:** Pending orders failed due to missing Login field and incorrect volume format
✅ **After:** Pending orders work correctly with proper payload format

The fix ensures that all pending order placements include:
1. Account ID (Login field)
2. Properly scaled volume (× 100)
3. All required fields (symbol, price, volume)
4. Proper authentication token
5. Detailed logging for debugging

