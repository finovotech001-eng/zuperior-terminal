# Quick Start - Instruments Setup

## ⚡ Run This Once to Setup Instruments

This guide shows you how to set up the instruments database and default favorites for all users.

---

## 🎯 What Will Happen

1. ✅ Database migration (creates Instrument and UserFavorite tables)
2. ✅ Sync all instruments from MT5 API to database (~1250 instruments)
3. ✅ Add default favorites to all existing users
4. ✅ Configure auto-favorites for new users

**Default Favorites (Added to All Users):**
- EUR/USD
- XAU/USD
- GBP/USD
- BTCUSD
- ETHUSD

---

## 🚀 Option 1: Automated Setup (Recommended)

### Windows

```bash
cd zuperior-terminal
.\scripts\setup-instruments.bat
```

### Linux/Mac

```bash
cd zuperior-terminal
chmod +x scripts/setup-instruments.sh
./scripts/setup-instruments.sh
```

**That's it!** The script will handle everything automatically.

---

## 🔧 Option 2: Manual Step-by-Step

If you prefer to run each step manually:

### Step 1: Generate Prisma Client

```bash
npx prisma generate
```

### Step 2: Run Migration

```bash
npx prisma migrate deploy
```

### Step 3: Sync Instruments

```bash
npx ts-node scripts/sync-instruments.ts
```

**Expected Output:**
```
🚀 Starting instrument sync...

📡 Getting authentication token...
✅ Authentication successful

📥 Fetching instruments from external API...
✅ Fetched 1250 instruments

💾 Saving to database...
   Processed: 1250/1250
✅ Database sync completed!
   Created: 1250
   Updated: 0
   Errors: 0
   Total: 1250

📊 Total instruments in database: 1250

📈 Instruments by category:
   forex: 450
   crypto: 200
   stocks: 300
   indices: 150
   commodities: 150

🎉 Sync completed successfully!
```

### Step 4: Add Default Favorites

```bash
npx ts-node scripts/add-default-favorites.ts
```

**Expected Output:**
```
🚀 Adding default favorites to all users...

📊 Found 10 users

Processing: user1@example.com... ✅ Added: 5, Skipped: 0
Processing: user2@example.com... ✅ Added: 5, Skipped: 0
...

📈 Summary:
   Total users processed: 10
   Total favorites added: 50
   Total skipped: 0

🎉 Default favorites added successfully!
```

---

## ✅ Verify Setup

### Check Instruments Count

```bash
# Using Prisma Studio
npx prisma studio

# Or using psql
psql -U your_user -d zuperior_terminal -c "SELECT COUNT(*) FROM \"Instrument\";"
```

Should show ~1250 instruments.

### Check Favorites

```bash
# Check favorites count
psql -U your_user -d zuperior_terminal -c "SELECT COUNT(*) FROM \"UserFavorite\";"
```

Should show 5 × number_of_users.

### Test in Application

1. Start the app: `npm run dev`
2. Login as any user
3. Go to terminal page
4. You should see 5 default favorites at the top:
   - EUR/USD
   - XAU/USD
   - GBP/USD
   - BTCUSD
   - ETHUSD

---

## 🔄 Auto-Favorites for New Users

The system is now configured to automatically add default favorites:

### ✅ On Registration

When a new user registers, default favorites are added automatically.

```typescript
// In app/apis/auth/register/route.ts
ensureDefaultFavorites(user.id)
```

### ✅ On Login

When any user logs in, the system checks if they have favorites. If not, it adds the defaults.

```typescript
// In app/apis/auth/login/route.ts
ensureDefaultFavorites(user.id)
```

**This means:**
- New users get defaults immediately
- Existing users get defaults on next login (if they don't have any)
- No user is left without favorites

---

## 🛠️ Customize Default Favorites

To change which pairs are added by default:

**File:** `lib/default-favorites.ts`

```typescript
// Change this array to your preferred default pairs
export const DEFAULT_FAVORITES = [
  'EUR/USD',  // ← Change these
  'XAU/USD',
  'GBP/USD',
  'BTCUSD',
  'ETHUSD',
]
```

Then re-run the favorites script:

```bash
npx ts-node scripts/add-default-favorites.ts
```

---

## 🔄 Periodic Sync (Optional)

To keep instruments updated, set up a cron job:

### Daily Sync at 2 AM

```bash
# Add to crontab (Linux/Mac)
crontab -e

# Add this line:
0 2 * * * cd /path/to/zuperior-terminal && npx ts-node scripts/sync-instruments.ts
```

### Or use Node-cron

```typescript
import cron from 'node-cron'

cron.schedule('0 2 * * *', () => {
  console.log('Running daily instrument sync...')
  // Run sync script
})
```

---

## ❌ Troubleshooting

### Error: "Missing environment variables"

**Solution:** Make sure your `.env` file has:

```env
NEXT_PUBLIC_API_BASE_URL=http://18.130.5.209:5003
MANAGER_USERNAME=your_username
MANAGER_PASSWORD=your_password
MANAGER_SERVER_IP=your_server_ip
MANAGER_PORT=443
MANAGER_LOGIN_PATH=/api/manager/login
MARKET_DATA_SYMBOLS_PATH=/api/symbols/all
```

### Error: "Manager login failed"

**Solution:** Check your manager credentials in `.env`

### Error: "Instrument not found" for default favorites

**Solution:** Make sure you ran the sync first:

```bash
npx ts-node scripts/sync-instruments.ts
```

### Error: "Table does not exist"

**Solution:** Run the migration:

```bash
npx prisma migrate deploy
```

---

## 📊 What Gets Created

### Database Tables

```sql
-- Instruments table (~1250 rows)
CREATE TABLE "Instrument" (
  id UUID PRIMARY KEY,
  symbol VARCHAR UNIQUE,
  category VARCHAR,
  ...
);

-- User favorites table (5 × users rows initially)
CREATE TABLE "UserFavorite" (
  id UUID PRIMARY KEY,
  userId UUID,
  instrumentId UUID,
  sortOrder INT,
  UNIQUE(userId, instrumentId)
);
```

### Initial Data

- **~1250 instruments** from MT5 API
- **5 favorites per user** (EUR/USD, XAU/USD, GBP/USD, BTCUSD, ETHUSD)

---

## 🎉 Success!

After setup, you should have:

✅ 1250+ instruments in database  
✅ 5 default favorites for all users  
✅ Auto-favorites for new users  
✅ Auto-favorites for existing users on login  
✅ Fast loading (<100ms from cache)  
✅ No more external API calls on every refresh

---

## 📚 More Information

- **Full Guide:** [INSTRUMENTS_SETUP_GUIDE.md](./INSTRUMENTS_SETUP_GUIDE.md)
- **Implementation Details:** [INSTRUMENTS_IMPLEMENTATION_SUMMARY.md](./INSTRUMENTS_IMPLEMENTATION_SUMMARY.md)
- **API Documentation:** See INSTRUMENTS_SETUP_GUIDE.md

---

**That's it! You're all set up!** 🚀

Any questions? Check the troubleshooting section or the full guides.

