# 🔄 Automatic Daily Refresh

## Overview

The app now automatically performs a hard refresh every day at **6:00 AM EST** to ensure you're always running the latest version with fresh cache.

## How It Works

### 🌅 **Daily Schedule**
- **Time:** 6:00 AM Eastern Standard Time (EST)
- **What happens:** 
  1. Clears service worker cache
  2. Clears browser cache
  3. Clears session storage
  4. Reloads the app with fresh data
  5. **Silent operation** - no pop-ups or confirmations

### ✅ **Safety Features**
- Only runs **once per day** (tracked via localStorage)
- Only runs within the **first 5 minutes** of 6am EST
- **Preserves your credentials** (Supabase settings stay intact)
- Can be **toggled on/off** in Settings

## Settings Control

### Enable/Disable Auto-Refresh

1. Open **Settings** ⚙️
2. Scroll to **App Update** section
3. Find "Auto-refresh at 6am EST"
4. Toggle the switch:
   - 🟢 **ON** = Enabled (default)
   - ⚪ **OFF** = Disabled

### Default State
Auto-refresh is **enabled by default** for all users.

## Benefits

✅ **Always up-to-date** - Latest features and fixes  
✅ **Fresh cache** - No stale data  
✅ **Improved performance** - Clean slate daily  
✅ **Zero effort** - Completely automatic  
✅ **Smart timing** - Early morning when least disruptive  

## Technical Details

### Time Conversion
- Runs at **6:00 AM EST** (UTC-5)
- Checks every minute between 6:00-6:05 AM EST
- Uses UTC time internally, converts to EST

### Storage Keys
- `auto_refresh_enabled` - Toggle state (true/false)
- `last_auto_refresh` - Date of last refresh (prevents duplicates)

### Manual Refresh
The manual "Refresh" button in Settings still works independently:
- Shows confirmation dialog
- Works anytime, not just at 6am
- Same cache-clearing functionality

## Testing

### Check if it's enabled:
```javascript
localStorage.getItem('auto_refresh_enabled')
// Returns: "true" or "false"
```

### See last refresh date:
```javascript
localStorage.getItem('last_auto_refresh')
// Returns: "Fri Nov 29 2024" (or null if never refreshed)
```

### Console output:
```
⏰ Daily auto-refresh scheduler started
   Status: Enabled
   Time: 6:00 AM EST
```

## FAQ

**Q: Will I lose my login credentials?**  
A: No, Supabase credentials are preserved during auto-refresh.

**Q: Can I disable it?**  
A: Yes, toggle it off in Settings → App Update.

**Q: What if I'm using the app at 6am?**  
A: The refresh will happen automatically. Your work will be lost if unsaved.

**Q: Does it work on mobile?**  
A: Yes, works on all devices where the app is open.

**Q: What if my device is off at 6am?**  
A: It only runs when the app is open in a browser tab.

## Manual Testing

To test without waiting until 6am:

1. Open browser console
2. Run: `autoHardRefreshApp()`
3. App will refresh immediately

Or modify the time check temporarily in code.

---

**Version:** v25.48.7  
**Feature Added:** November 29, 2024

