# Account Switch Fix - Testing Guide

## ✅ What Was Fixed

I identified and fixed the issue where positions only showed on page refresh but not when switching accounts in the same session.

### Root Cause
When switching accounts without refreshing:
1. The old SSE connection wasn't being closed before starting the new one
2. State wasn't being properly reset between account switches
3. The sequence tracking could block new data from the new account

### Changes Made

**File**: `hooks/usePositionsSSE.ts`

#### 1. Proper Cleanup Before New Connection
```typescript
// Now explicitly closes old connection BEFORE starting new one
if (sseRef.current) {
  console.log('[Positions] Closing previous SSE connection')
  sseRef.current.close()
  sseRef.current = null
}
```

#### 2. Complete State Reset
```typescript
// Clears all timers and resets state
if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
if (snapshotTimeout.current) clearTimeout(snapshotTimeout.current)
setPositions([])
setIsConnected(false)
setError(null)
```

#### 3. Delayed Connection Start
```typescript
// Small 100ms delay ensures cleanup completes before new connection
const switchTimeout = setTimeout(() => {
  authenticate(accountId)
    .then(token => connect(accountId, token))
}, 100)
```

#### 4. Enhanced Sequence Tracking Logs
Now shows exactly why messages might be blocked:
- Component unmounted
- Sequence mismatch
- Which sequence is expected vs received

## 🧪 How to Test

### Test 1: Basic Account Switch

1. **Start fresh** - Refresh the page
2. **Load Account A** - Should see positions
3. **Switch to Account B** - Should see positions update immediately
4. **Switch back to Account A** - Should see positions update again
5. **Switch multiple times** - Each switch should work

### Test 2: Rapid Switching

1. Quickly switch between 2-3 accounts
2. Positions should update for the final account selected
3. No stale data from previous accounts

### Test 3: Empty Account

1. Switch to an account with NO positions
2. Should show empty positions list (not stale data)
3. Switch to account WITH positions
4. Should show the new positions

## 📋 Expected Console Output

When you switch from Account A (12345) to Account B (19876964), you should see:

```
🔄 [Positions] Account changed to: 19876964
[Positions] Closing previous SSE connection           ← NEW - shows cleanup
🔐 [Positions] Authenticating for account: 19876964
✅ [Positions] Authentication successful for account: 19876964
[Positions] Fetching snapshot for 19876964 seq 2 current seq: 2
[Positions][DEBUG] Snapshot response status: 200
[Positions][DEBUG] Snapshot raw response: {...}
[Positions][DEBUG] Final array length: 5              ← Shows positions found
[Positions][SSE] opening stream for account 19876964, seq 2
[Positions][SSE] Connection opened for seq: 2 current seq: 2
[Positions][SSE] Connected successfully for account: 19876964
[Positions] Snapshot count: 5                         ← Positions loaded!
```

### ⚠️ Watch For These Issues (Now Fixed)

**If you see:**
```
[Positions][SSE] Message ignored - sequence mismatch. Expected: 3 Got: 2
```
This means old messages are being correctly ignored (working as intended).

**If you see:**
```
[Positions] Snapshot aborted - sequence mismatch
```
This should NO LONGER happen with the fix - if it does, let me know.

## 🔍 Debugging

If positions still don't show after switching:

### Check 1: Are positions actually there?
Look for:
```
[Positions][DEBUG] Final array length: 0
```
If it's 0, the account genuinely has no positions.

### Check 2: Is sequence blocking?
Look for:
```
[Positions][SSE] Message ignored - sequence mismatch
```
If you see this for EVERY message, there's still a sequence issue.

### Check 3: Is cleanup happening?
Look for:
```
[Positions] Closing previous SSE connection
```
Should appear every time you switch accounts.

### Check 4: Is authentication working?
Look for:
```
✅ [Positions] Authentication successful for account: XXXXX
```
Should show the NEW account ID, not the old one.

## 🎯 Success Criteria

✅ Switch between any 2 accounts → positions update
✅ Switch rapidly between 3+ accounts → final account shows correctly
✅ Switch to empty account → clears positions
✅ Switch back to account with positions → positions reappear
✅ No page refresh needed between switches

## ⚡ Performance Notes

- Added a 100ms delay between account switches for reliable cleanup
- This is barely noticeable to users but ensures clean state transitions
- The delay can be reduced to 50ms if needed (test thoroughly)

## 🐛 If It Still Doesn't Work

If positions still don't show after these fixes:

1. **Clear browser cache completely** (Ctrl+Shift+Delete)
2. **Hard refresh** (Ctrl+Shift+R)
3. **Copy ALL console logs** from a switch attempt
4. **Share the logs** - especially looking for:
   - Any "Message ignored" logs
   - The sequence numbers
   - The array length from snapshot

## 📊 Next Steps

1. **Test the fix** by switching accounts multiple times
2. **Share the results** - let me know if it works or if you see specific errors
3. **Check the console logs** for the new detailed output

The fix ensures proper cleanup and state management when switching accounts, which should resolve the issue completely! 🚀

