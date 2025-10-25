# SignalR Real-Time Positions Implementation

## Overview

This implementation connects to the MT5 Trading API's SignalR hub to receive real-time position updates for trading accounts. Positions are updated every 300ms to provide live trading data.

## Architecture

### 1. Authentication Flow

```
User selects MT5 Account
      ↓
Request to /apis/auth/mt5-login
      ↓
Fetch AccountId & Password from Database (MT5Account table)
      ↓
POST to http://18.130.5.209:5003/api/client/ClientAuth/login
      ↓
Receive Access Token
      ↓
Connect to SignalR Hub with Token
```

### 2. SignalR Connection

**Hub URL:** `http://18.130.5.209:5003/hubs/mobiletrading`

**Headers:**
- `Authorization: Bearer {accessToken}`
- `X-Account-ID: {accountId}`

**Transport:** WebSockets with LongPolling fallback

### 3. Position Updates

The connection receives real-time position updates through the following events:

- `PositionUpdate` - Full position data or individual position update
- `PositionOpened` - New position opened
- `PositionClosed` - Position closed

Positions are automatically refreshed every **300ms** via periodic `GetPositions` calls.

## Files Modified/Created

### Created Files

1. **`hooks/usePositionsSignalR.ts`**
   - Custom React hook for SignalR connection
   - Manages authentication, connection, and position updates
   - Handles reconnection logic with exponential backoff

2. **`app/apis/auth/mt5-login/route.ts`**
   - API route to authenticate with MT5 server
   - Fetches credentials from database
   - Returns access token for SignalR connection

3. **`docs/SIGNALR_POSITIONS.md`**
   - This documentation file

### Modified Files

1. **`app/terminal/page.tsx`**
   - Integrated `usePositionsSignalR` hook
   - Replaced mock positions with real SignalR data
   - Added position formatting and error handling

2. **`lib/env.ts`**
   - Added `LIVE_API_URL` environment variable

## Hook Usage

```typescript
import { usePositionsSignalR } from '@/hooks/usePositionsSignalR';

// In your component
const { 
  positions,       // Array of current positions
  isConnected,     // Connection status
  isConnecting,    // Connecting state
  error,           // Error message if any
  reconnect        // Manual reconnect function
} = usePositionsSignalR({
  accountId: currentAccountId,
  enabled: true
});
```

## Position Data Structure

```typescript
interface SignalRPosition {
  id: string;              // Unique identifier
  ticket: number;          // MT5 ticket number
  symbol: string;          // Trading symbol
  type: 'Buy' | 'Sell';   // Position type
  volume: number;          // Position volume (lots)
  openPrice: number;       // Opening price
  currentPrice: number;    // Current market price
  takeProfit?: number;     // Take profit level
  stopLoss?: number;       // Stop loss level
  openTime: string;        // Opening time (ISO)
  swap: number;            // Swap/rollover cost
  profit: number;          // Current profit/loss
  commission: number;      // Commission paid
  comment?: string;        // Position comment
}
```

## Configuration

### Environment Variables

Add to your `.env` or `.env.local`:

```bash
# MT5 Live Trading API
LIVE_API_URL=http://18.130.5.209:5003/api
```

### Database Schema

The MT5Account table must have the following fields:

```prisma
model MT5Account {
  id        String   @id @default(uuid())
  accountId String   @unique    // MT5 Account ID
  userId    String               // User who owns this account
  password  String?              // MT5 Account Password (required for SignalR)
  // ... other fields
}
```

**Important:** The `password` field must be populated for each MT5 account to enable SignalR authentication.

## Features

### ✅ Implemented

- Real-time position updates (300ms interval)
- Automatic authentication with MT5 API
- SignalR connection with WebSocket/LongPolling
- Automatic reconnection on disconnect
- Position open/close event handling
- Multi-account support (switches when user changes account)
- Error handling and logging
- Connection status indicators

### 🔄 Automatic Behaviors

- **Auto-reconnect:** If connection drops, automatically attempts to reconnect after 5 seconds
- **Auto-refresh:** Positions are refreshed every 300ms while connected
- **Auto-cleanup:** Connection is properly closed when component unmounts or account changes

## Error Handling

The hook provides comprehensive error handling:

```typescript
// Connection errors
if (error) {
  console.error('Position connection error:', error);
}

// Manual reconnection
if (error && !isConnecting) {
  reconnect(); // Trigger manual reconnect
}
```

Common errors:
- **Authentication failed:** Check AccountId and Password in database
- **Connection timeout:** Check network connectivity to SignalR hub
- **Invalid account:** Ensure account exists in database

## Testing

### Manual Test

1. Ensure MT5 account credentials are in database
2. Select an account in the terminal
3. Check browser console for connection logs:
   - `🔐 Authenticating for account: {accountId}`
   - `✅ Authentication successful`
   - `🔌 Connecting to SignalR hub`
   - `✅ SignalR connected successfully`
   - `📊 Subscribed to positions`

### Verify Positions

Open positions should appear in the Positions Table automatically:
- Check "Open" tab in Positions Table
- Verify real-time updates every 300ms
- Test switching between accounts

## Performance

- **Update Frequency:** 300ms (configurable via `UPDATE_INTERVAL` constant)
- **Reconnect Delay:** 5000ms (configurable via `RECONNECT_DELAY` constant)
- **Transport:** WebSockets (fallback to LongPolling if unavailable)

## Security

- Access tokens are obtained server-side to protect credentials
- MT5 passwords are stored securely in database (should be encrypted)
- SignalR connection uses Bearer token authentication
- Account ID is validated against user's linked accounts

## Debugging

Enable detailed logging by checking browser console:

```typescript
// Connection status
console.log('✅ Positions Connected. Count:', formattedPositions.length);
console.log('🔄 Positions Connecting...');
console.log('❌ Positions Error:', error);

// SignalR events
console.log('📊 Position update received:', data);
console.log('🟢 Position opened:', data);
console.log('🔴 Position closed:', data);
```

## Future Enhancements

- [ ] Add position modification via SignalR (modify TP/SL)
- [ ] Add position close functionality
- [ ] Implement pending orders support
- [ ] Add closed positions history
- [ ] Add position statistics and analytics
- [ ] Implement position grouping by symbol
- [ ] Add audio/visual notifications for position events

## Support

For issues or questions:
1. Check browser console for error logs
2. Verify MT5 account credentials in database
3. Test SignalR connection directly using browser dev tools
4. Check network connectivity to `18.130.5.209:5003`

## License

Proprietary - Zuperior Trading Platform


