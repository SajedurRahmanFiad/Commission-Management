# Real-Time Badges - Test Scenarios

## Test Setup
1. Open CommishPro app and log in as admin (admin@system.com / admin)
2. Keep developer console open to monitor polling activity
3. Optionally open second browser window for multi-window testing

## Test Scenario 1: Admin - Pending Sales Badge

### Steps:
1. Log in as admin
2. Check "Sales" tab - should show no badge initially (or badge count if pending sales exist)
3. Create a new sale by:
   - Go to Dashboard or Products
   - Create a sale with status "pending"
   - Sale should appear in database/sales.json with `"status": "pending"`
4. Within 5 seconds, "Sales" tab should show badge with count "1"
5. Click Sales tab to view pending sale
6. Approve the sale (change status to "completed")
7. Refresh or wait 5 seconds - badge should disappear

### Expected Behavior:
- Badge appears within 5 seconds of pending sale creation
- Badge count matches number of pending sales
- Badge disappears when all sales are approved

### Console Output:
```
Fetched database state from /api/db:
[sales data]
Error polling database: [any errors]
```

---

## Test Scenario 2: Admin - Pending Withdrawals Badge

### Steps:
1. Log in as admin
2. Check "Withdraw" tab - should show no badge initially
3. Create a pending withdrawal:
   - Go to Withdraw tab
   - Create withdrawal request with status "pending"
4. Within 5 seconds, "Withdraw" tab should show badge with count
5. Complete the withdrawal (change status to "completed")
6. Badge should disappear within 5 seconds

### Expected Behavior:
- Separate badge for withdrawals (different from sales badge)
- Updates independently
- Both Sales and Withdraw can have badges at same time

---

## Test Scenario 3: Employee - Announcements Badge

### Steps:
1. Create/login with an employee account (non-admin)
2. Check "Announcements" tab - should show no badge initially
3. Log back in as admin
4. Create an announcement via Announcements tab
5. Switch back to employee
6. Within 5 seconds, "Announcements" tab should show badge
7. Badge count = total number of announcements

### Expected Behavior:
- Employee sees announcements badge, NOT sales/withdraw badges
- Badge shows whenever announcements exist
- Admin creates announcements, employees see badges

---

## Test Scenario 4: Real-Time Multi-Window Sync

### Steps:
1. Open CommishPro in two browser windows
2. Log in as admin in BOTH windows
3. In Window A: Create a pending sale
4. Watch Window B: Within 5 seconds, "Sales" badge should appear
5. In Window A: Approve the sale
6. Watch Window B: Within 5 seconds, "Sales" badge should disappear
7. In Window B: Create a withdrawal request
8. Watch Window A: Within 5 seconds, "Withdraw" badge should appear

### Expected Behavior:
- Changes in one window immediately affect another
- Polling ensures synchronization
- No manual refresh needed

---

## Test Scenario 5: Login/Logout Behavior

### Steps:
1. Log in as admin
2. Verify polling is working (check console)
3. Check badge counts
4. Log out
5. Polling should stop (no more API calls)
6. Log back in
7. Polling should resume

### Expected Behavior:
- Polling only active when user logged in
- Console shows no errors on logout
- Clean startup on next login
- Memory properly cleaned up

---

## Test Scenario 6: Badge Display Limits

### Steps:
1. Create 150+ pending sales (edit database/sales.json directly or via multiple creations)
2. Wait for badge update (5 seconds)
3. Check "Sales" tab badge

### Expected Behavior:
- Badge shows "99+" (not "150")
- Large counts are truncated to prevent UI overflow
- Badge size remains consistent

---

## Test Scenario 7: Mixed Role Badges

### Prerequisites:
- Admin user and multiple employee users

### Steps:
1. Log in as Admin
   - Should see Sales, Withdraw, Employees, AND Announcements tabs
   - Badges appear only for Sales and Withdraw tabs
2. Create a pending sale as admin
   - Admin's "Sales" badge shows count
3. Create announcements as admin
4. Switch to employee account
   - Should see Announcements badge, NOT Sales badge
   - Announcements badge count = total announcements
5. Go back to admin
   - Sales badge still shows (independent)

### Expected Behavior:
- Admin badges: Sales + Withdraw only
- Employee badges: Announcements only
- No cross-role badge display
- Independent badge calculations

---

## Test Scenario 8: Database Sync After Page Refresh

### Steps:
1. Create pending sales/withdrawals
2. Note badge counts
3. Hard refresh page (Ctrl+Shift+R)
4. Wait for data to load
5. Check badges immediately

### Expected Behavior:
- Badges recalculate correctly after refresh
- No loss of badge data
- Consistent count with database

---

## Test Scenario 9: Badge Styling Under Different States

### Steps:
1. Check badge appearance when:
   - Badge count = 1
   - Badge count = 10
   - Badge count = 99
   - Badge count = 100+
2. Check on different screen sizes
3. Check in light and dark modes

### Expected Behavior:
- Badge always visible and readable
- Red color stands out against background
- Size remains consistent
- Works on mobile/tablet views

---

## Test Scenario 10: Error Handling

### Steps:
1. Break database connectivity (stop API server)
2. App should still function
3. Polling errors should appear in console
4. Restart API server
5. Polling should resume after next attempt

### Expected Behavior:
- App doesn't crash on polling errors
- Errors logged to console (not shown to user)
- Auto-recovery when connection restored
- No infinite error loops

---

## Performance Testing

### Metrics to Monitor:
1. **Polling Frequency**: Should see API call every ~5 seconds
2. **Network Usage**: Each poll should be <10KB
3. **CPU Usage**: Should be minimal, no continuous spinning
4. **Memory Usage**: Should be stable, no memory leaks

### Steps:
1. Open DevTools → Network tab
2. Filter by XHR/Fetch requests
3. Monitor for 1 minute
4. Count requests (~12 for 5-second polling)
5. Check request size (~1-5KB each)

### Expected Behavior:
- Consistent 5-second intervals
- Small payload sizes
- No unusual activity
- Proper cleanup on logout

---

## Cleanup After Testing
1. Delete test sales/withdrawals from database files
2. Verify badges clear
3. Test data should not persist
4. Database should remain clean
