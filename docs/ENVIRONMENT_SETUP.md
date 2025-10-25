# Environment Setup for SignalR Positions

## Required Environment Variables

Add the following to your `.env` or `.env.local` file:

```bash
# MT5 Live Trading API for SignalR Connection
LIVE_API_URL=http://18.130.5.209:5003/api
```

## Database Setup

### MT5Account Password Field

The SignalR positions feature requires the `password` field to be populated in the `MT5Account` table. This password is used to authenticate with the MT5 trading API.

**Important:** Ensure each MT5 account has the password field filled:

```sql
-- Example: Update an MT5 account with password
UPDATE "MT5Account"
SET password = 'Test@000'
WHERE accountId = '19876966';
```

**Security Note:** In production, passwords should be encrypted before storage. Consider using a secure encryption library like `crypto` or `bcryptjs`.

## Testing the Connection

### 1. Check Database

Ensure your MT5 account has a password:

```sql
SELECT id, accountId, password
FROM "MT5Account"
WHERE userId = 'your-user-id';
```

### 2. Test Authentication API

```bash
curl -X POST http://localhost:3000/apis/auth/mt5-login \
  -H "Content-Type: application/json" \
  -d '{"accountId": "19876966"}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "accountId": "19876966",
    "expiresIn": 3600
  }
}
```

### 3. Verify SignalR Connection

1. Start your development server: `npm run dev`
2. Navigate to `/terminal`
3. Open browser console
4. Look for these log messages:
   - `🔐 Authenticating for account: {accountId}`
   - `✅ Authentication successful`
   - `🔌 Connecting to SignalR hub`
   - `✅ SignalR connected successfully`
   - `📊 Subscribed to positions`

### 4. Monitor Position Updates

- Check the "Open" tab in the Positions Table
- You should see positions updating every 300ms
- Console should show: `📊 Position update received`

## Troubleshooting

### Issue: "No access token received"

**Solution:** Check that the MT5 API is running and accessible at `http://18.130.5.209:5003`

### Issue: "MT5 account password not configured"

**Solution:** Update the MT5Account record in database with the password field

### Issue: "Authentication failed"

**Possible causes:**
1. Incorrect AccountId or Password in database
2. MT5 API is down or unreachable
3. Network connectivity issues

**Check:**
```bash
# Test API connectivity
curl http://18.130.5.209:5003/api/health
```

### Issue: SignalR not connecting

**Possible causes:**
1. WebSockets blocked by firewall
2. CORS issues
3. Authentication token expired

**Solutions:**
- Check browser console for CORS errors
- Verify SignalR hub is accessible
- Try reconnecting by switching accounts

## Development Tips

### Enable Verbose Logging

The SignalR connection uses `.configureLogging(signalR.LogLevel.Information)` by default. For more detailed logs, change to:

```typescript
.configureLogging(signalR.LogLevel.Debug)
```

### Test with Multiple Accounts

1. Add multiple MT5 accounts to database
2. Switch between accounts in the terminal
3. Verify positions update for each account

### Adjust Update Frequency

In `hooks/usePositionsSignalR.ts`, modify:

```typescript
const UPDATE_INTERVAL = 300; // Change to desired interval in ms
```

## Production Checklist

- [ ] LIVE_API_URL environment variable configured
- [ ] All MT5 accounts have passwords set
- [ ] Passwords are encrypted in database
- [ ] SignalR hub is accessible from production servers
- [ ] SSL/TLS configured for production API
- [ ] Error monitoring and logging in place
- [ ] Performance monitoring for position updates
- [ ] Backup authentication method available

## Security Recommendations

### 1. Encrypt MT5 Passwords

```typescript
import bcrypt from 'bcryptjs';

// When storing password
const hashedPassword = await bcrypt.hash(plainPassword, 10);

// When retrieving for API call
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

### 2. Secure Environment Variables

- Never commit `.env` files to version control
- Use different credentials for development/production
- Rotate passwords regularly
- Use secret management service in production (e.g., AWS Secrets Manager, HashiCorp Vault)

### 3. Rate Limiting

Consider implementing rate limiting on the authentication endpoint:

```typescript
// In app/apis/auth/mt5-login/route.ts
import { rateLimit } from '@/lib/rate-limit';

// Add rate limit check
const identifier = session.userId;
const { success } = await rateLimit.limit(identifier);

if (!success) {
  return NextResponse.json(
    { success: false, message: 'Too many requests' },
    { status: 429 }
  );
}
```

## Support

If you encounter issues not covered here:

1. Check the SignalR Positions documentation: `docs/SIGNALR_POSITIONS.md`
2. Review browser console logs
3. Check network tab in dev tools
4. Verify database schema and data
5. Test API endpoints individually

## Next Steps

After successful setup:

1. Test position updates with real trading
2. Verify all position fields display correctly
3. Test account switching
4. Monitor performance and connection stability
5. Implement additional features (modify/close positions)


