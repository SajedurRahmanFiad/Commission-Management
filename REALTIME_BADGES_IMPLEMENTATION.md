# Real-Time Notification Badges Implementation

## Overview
Added real-time notification badges to show pending items in the CommishPro app. The badges appear next to tab names and display counts of unverified/incomplete items that need attention.

## What Was Implemented

### 1. **Notification Badge Service** (`services/notificationBadgeService.ts`)
- Created `calculateBadgeCounts()` function that calculates badge counts based on user role:
  - **Admin**: Counts pending sales (`status === 'pending'`) and incomplete withdrawals (`status === 'pending'`)
  - **Employee**: Counts total announcements (all are considered new/unread)
- Created `hasPendingItems()` helper to check if any badges should be shown
- Exports `BadgeCounts` interface for type safety

### 2. **Layout Component Updates** (`components/Layout.tsx`)
- Added `badgeCounts?: BadgeCounts` prop to `LayoutProps` interface
- Created a `Badge` component that displays red circular badge with count
- Modified `Navigation` component to:
  - Check badge count for each menu item
  - Display badge only if count > 0
  - Show badge next to Sales, Withdraw, and Announcements tabs
- Badge styling: Red circle (bg-red-500) with white text, shows "99+" for counts over 99

### 3. **App Component Updates** (`App.tsx`)
- Imported `calculateBadgeCounts` from notification badge service
- Added **real-time polling effect** that:
  - Activates when user is logged in (`state.currentUser` exists)
  - Polls the database every 5 seconds via `fetchDatabaseState()`
  - Updates state with latest sales, announcements, and withdrawals
  - Automatically cleans up interval on unmount or logout
- Created `badgeCounts` useMemo that:
  - Recalculates whenever sales, withdrawals, or announcements change
  - Calls `calculateBadgeCounts()` with current user role and data
  - Returns default counts (0) when no user is logged in
- Passes `badgeCounts` to Layout component

## Real-Time Behavior

The app now:
1. **Polls the database every 5 seconds** when user is logged in
2. **Updates badges instantly** when pending sales, incomplete withdrawals, or announcements change
3. **Shows role-specific badges**:
   - Admins see badges for Sales (pending) and Withdrawals (pending)
   - Employees see badges for Announcements
4. **Removes badges** when all pending items are cleared (count = 0)
5. **Stops polling** when user logs out or closes the browser

## Visual Indicators

- **Badge Style**: Red circular badge with white text
- **Position**: Next to tab label in sidebar navigation
- **Format**: Shows actual count (e.g., "3") or "99+" for counts over 99
- **Visibility**: Only appears when count > 0

## Database Integration

The implementation watches for changes in:
- `sales` array → Counts items with `status === 'pending'`
- `withdrawRequests` array → Counts items with `status === 'pending'`
- `announcements` array → Counts all items for employees

Changes are detected automatically through:
1. Real-time polling (5-second interval)
2. State updates when data is fetched from database
3. Badge recalculation via useMemo dependencies

## Technical Details

- **Polling Interval**: 5 seconds (configurable in App.tsx line 194)
- **Performance**: Uses `useMemo` to avoid unnecessary recalculations
- **Cleanup**: Properly clears intervals on component unmount
- **Type Safety**: Uses TypeScript interfaces for badge counts
- **No Breaking Changes**: All updates are additive, no existing features modified

## Testing the Feature

1. **For Admins**:
   - Create a pending sale (status: 'pending') → See badge on "Sales" tab
   - Create a pending withdrawal (status: 'pending') → See badge on "Withdraw" tab
   - Approve sales/withdrawals → Badges update and disappear

2. **For Employees**:
   - Announcements are created by admin → See badge on "Announcements" tab
   - Count increases with each new announcement

3. **Real-Time**:
   - Open app in two browser windows
   - Change data in one window (e.g., create pending sale)
   - Watch other window update badges within 5 seconds
