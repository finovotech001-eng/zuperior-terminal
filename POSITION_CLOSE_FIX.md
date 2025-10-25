# Position Close Error Fix

## Problem
Users were encountering an error when trying to close trades repeatedly:
```
Close failed: could not resolve numeric ticket for id "sym-BTCUSDm-idx-0"
```

## Root Cause
The issue occurred when positions received from the SignalR/SSE stream didn't have valid ticket numbers. The SSE hook (`usePositionsSSE.ts`) would generate fallback IDs in the format:
- `ticket-{number}` - when ticket exists
- `alt-{number}` - when alternative ID exists
- `sym-{symbol}-ot-{openTime}` - when open time exists
- `sym-{symbol}-idx-{index}` - when nothing else is available

When these fallback IDs (especially `sym-{symbol}-idx-{index}`) were used, the close handler couldn't resolve them back to numeric ticket numbers needed for the close API call.

## Changes Made

### 1. `hooks/usePositionsSSE.ts`
**Improved ID generation logic:**
- Better handling of alternative IDs that can be converted to numbers
- Now extracts numeric values from alternative ID fields and formats them as `ticket-{number}` for consistency
- This ensures more positions have parseable ticket IDs
- **Added warning logging** when positions don't have valid tickets and fallback IDs are used
- Logs the raw data keys to help identify what fields are available

### 2. `app/terminal/page.tsx`
**Enhanced ticket resolution in close handler:**
- Added **6-step ticket resolution process**:
  1. Check `idToTicket` map first
  2. Try parsing ID directly as a number
  3. Extract ticket from `ticket-{number}` or `alt-{number}` format using regex
  4. Try extracting from the position's display field
  5. Fallback to field-based matching (symbol + volume + price)
  6. Final fallback: fetch fresh snapshot and resolve by fields with detailed logging

**Improved `idToTicket` map:**
- Now uses the actual position ID from the SSE hook instead of recreating ID logic
- Added debug logging to track mappings
- Better consistency between ID generation and lookup

**Better `formattedPositions` generation:**
- Uses position IDs directly from the SSE hook
- Removed duplicate ID generation logic that could cause mismatches
- More robust position field handling

**Comprehensive diagnostic logging:**
- **At startup:** Logs raw and formatted position samples
- **Position warnings:** Detects and warns about positions without valid tickets
- **Resolution attempts:** Logs each step of the ticket resolution process
- **Snapshot fallback:** Detailed logging of snapshot fetch, data extraction, and matching
- **Error details:** Shows:
  - Which ID failed to resolve
  - Position details (formatted and raw)
  - Available ticket mappings
  - All raw positions for context
- **Success logging:** Confirms which method resolved the ticket
- **User-facing alert:** Shows helpful error message when close fails

**Improved field-based resolution:**
- Increased tolerance for volume and price matching (handles minor floating-point differences)
- Added debug logging to track resolution attempts
- Better ticket validation
- Logs matching criteria and results

## Impact
- Positions with valid tickets (even in alternative formats) can now be closed reliably
- Better error messages help diagnose issues when resolution fails
- More robust handling of edge cases where ticket numbers might be missing or in unexpected formats
- Reduced likelihood of "could not resolve numeric ticket" errors

## Testing Recommendations
1. Open positions and verify they get proper IDs (check console logs)
2. Try closing positions multiple times to ensure consistent behavior
3. Test with positions that have:
   - Normal ticket numbers
   - Alternative ID formats
   - Missing ticket information
4. Monitor console logs for the new debug output to verify resolution paths

## Troubleshooting Guide

If you still see the error `"could not resolve numeric ticket for id"`, check the console logs for:

### 1. Check Position Data Quality
Look for warnings like:
```
⚠️ [Positions] Found X positions without valid tickets
[SSE] Position without ticket - using fallback ID
```
This indicates the server is sending positions without ticket numbers.

### 2. Review Raw Data Structure
Check the console output for:
```
[Positions][RAW sample]
[Positions][FORMATTED sample]
```
Look at what fields are available in the raw data. The ticket should be in one of these fields:
- `Ticket` or `ticket`
- `Position` or `position`
- `PositionId`, `PositionID`
- `Order`, `OrderId`

### 3. Analyze Close Attempt Logs
When you try to close, look for the resolution attempt logs:
```
[idToTicket] Created mapping with X entries
[Close] Attempting snapshot fallback
[Close] Snapshot response status: 200
[Close] Snapshot data: {...}
```

### 4. Common Issues and Solutions

**Issue:** Positions have `ticket: 0` or undefined
- **Cause:** Server data doesn't include ticket numbers
- **Solution:** Check the SignalR/SSE endpoint or API response format

**Issue:** Snapshot fallback fails
- **Cause:** Snapshot endpoint returns different data structure
- **Solution:** Review the snapshot logs to see what data is returned

**Issue:** Field matching doesn't find position
- **Cause:** Volume normalization or price precision differences
- **Solution:** Check if the volume/price values match between display and raw data

### 5. Workaround
If the issue persists, try:
1. Refresh the page to get fresh position data
2. Check if the position can be closed from another interface (MT5 terminal)
3. Contact support with the console logs showing the raw position data

