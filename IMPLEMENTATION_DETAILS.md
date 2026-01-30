# Implementation Details - Code Changes

## Files Created

### 1. `services/notificationBadgeService.ts` (NEW FILE)
**Purpose**: Centralized logic for calculating badge counts based on user role and data

**Key Exports**:
- `BadgeCounts` interface - defines structure {sales, withdraw, announcements}
- `calculateBadgeCounts()` - main function that returns badge counts
- `hasPendingItems()` - helper to check if any badges should show

**Logic**:
- Admin: counts pending (status='pending') sales and withdrawals
- Employee: counts all announcements
- Returns {sales: 0, withdraw: 0, announcements: 0}

---

## Files Modified

### 2. `components/Layout.tsx` (MODIFIED)
**Changes Made**:

#### Import Added (Line 4):
```typescript
import { BadgeCounts } from '../services/notificationBadgeService';
```

#### Interface Updated (Lines 7-14):
```typescript
interface LayoutProps {
  // ... existing props
  badgeCounts?: BadgeCounts;  // NEW
}
```

#### Component Destructuring (Line 32):
```typescript
const Layout: React.FC<LayoutProps> = ({ 
  children, currentUser, onLogout, activeTab, setActiveTab, 
  onClearNotifications, 
  badgeCounts  // NEW
}) => {
```

#### Badge Defaults (Line 37):
```typescript
const badges = badgeCounts || { sales: 0, withdraw: 0, announcements: 0 };
```

#### Navigation Component Modified (Lines 61-94):
- Added loop through menuItems
- Extract badge count for each item
- Conditionally render red badge circle with count
- Badge only shows if count > 0

**Badge HTML**:
```typescript
{badgeCount > 0 && (
  <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
    {badgeCount > 99 ? '99+' : badgeCount}
  </span>
)}
```

---

### 3. `App.tsx` (MODIFIED)
**Changes Made**:

#### Import Added (Line 7):
```typescript
import { calculateBadgeCounts } from './services/notificationBadgeService';
```

#### Real-Time Polling Effect Added (Lines 175-195):
```typescript
// Real-time polling for database updates (every 5 seconds)
useEffect(() => {
  if (!state.currentUser) return; // Only poll when user is logged in

  const pollInterval = setInterval(async () => {
    try {
      const dbData = await fetchDatabaseState();
      if (dbData) {
        setState(prev => ({
          ...prev,
          sales: dbData.sales && Array.isArray(dbData.sales) ? dbData.sales : prev.sales,
          announcements: dbData.announcements && Array.isArray(dbData.announcements) ? dbData.announcements : prev.announcements,
          withdrawRequests: dbData.withdrawRequests && Array.isArray(dbData.withdrawRequests) ? dbData.withdrawRequests : prev.withdrawRequests,
          users: dbData.users && Array.isArray(dbData.users) && dbData.users.length > 0 ? dbData.users : prev.users,
          adminWallet: typeof dbData.adminWallet === 'number' ? dbData.adminWallet : prev.adminWallet,
        }));
      }
    } catch (error) {
      console.error('Error polling database:', error);
    }
  }, 5000); // Poll every 5 seconds

  return () => clearInterval(pollInterval);
}, [state.currentUser]);
```

#### Badge Counts Calculation Added (Lines 460-471):
```typescript
// Calculate badge counts for tabs based on user role
const badgeCounts = useMemo(() => {
  if (!state.currentUser) {
    return { sales: 0, withdraw: 0, announcements: 0 };
  }
  return calculateBadgeCounts(
    state.currentUser.role,
    state.sales,
    state.withdrawRequests,
    state.announcements
  );
}, [state.currentUser, state.sales, state.withdrawRequests, state.announcements]);
```

#### Layout Prop Updated (Line 509):
```typescript
<Layout
  currentUser={state.currentUser}
  onLogout={handleLogout}
  activeTab={activeTab}
  setActiveTab={(t) => { setActiveTab(t); setSelectedProductId(null); }}
  onClearNotifications={clearNotifications}
  badgeCounts={badgeCounts}  // NEW
>
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     App.tsx                                  │
│  Manages state: sales, withdrawals, announcements           │
└──────────────────┬──────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
    [5s Polling]     [useEffect watches deps]
    fetchDatabaseState  triggers useMemo
         │                   │
         │                   ▼
         │         ┌──────────────────────┐
         │         │   badgeCounts        │
         │         │   useMemo hook       │
         │         │   Recalculates when: │
         │         │   - role changes     │
         │         │   - sales change     │
         │         │   - withdrawals      │
         │         │   - announcements    │
         │         └──────────┬───────────┘
         │                    │
         └────────┬───────────┘
                  │
                  ▼
         ┌──────────────────────┐
         │ calculateBadgeCounts │
         │ notificationBadge    │
         │ Service              │
         │                      │
         │ Admin logic:         │
         │  - count pending     │
         │    sales             │
         │  - count pending     │
         │    withdrawals       │
         │                      │
         │ Employee logic:      │
         │  - count all         │
         │    announcements     │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ BadgeCounts object   │
         │ {                    │
         │   sales: number      │
         │   withdraw: number   │
         │   announcements: num │
         │ }                    │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Layout Component     │
         │ Receives badgeCounts │
         │ Renders badges in    │
         │ Navigation           │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │ Red Badge Circles    │
         │ Next to:             │
         │ - Sales tab          │
         │ - Withdraw tab       │
         │ - Announcements tab  │
         └──────────────────────┘
```

---

## Data Updates Cycle

1. **Initial Load**:
   - User logs in
   - `state.currentUser` is set
   - Polling effect activates

2. **Every 5 Seconds**:
   - `setInterval` triggers
   - `fetchDatabaseState()` called
   - Updates state with latest data

3. **State Update Triggers**:
   - `badgeCounts` useMemo dependencies change
   - `calculateBadgeCounts()` runs automatically
   - Returns new badge counts

4. **Layout Re-renders**:
   - New `badgeCounts` prop passed
   - Navigation component updates badges
   - Red circles appear/disappear based on counts

5. **User Logs Out**:
   - `state.currentUser` becomes null
   - Polling effect cleanup runs
   - `clearInterval()` stops polling
   - No more API calls

---

## Type Definitions Used

```typescript
// From types.ts
type Role = 'admin' | 'employee';

interface Sale {
  // ... other fields
  status: 'pending' | 'completed';  // Key field
}

interface WithdrawRequest {
  // ... other fields
  status: 'pending' | 'completed';  // Key field
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: string;
}

// From notificationBadgeService.ts
interface BadgeCounts {
  sales: number;
  withdraw: number;
  announcements: number;
}
```

---

## Configuration Points

### Polling Interval (App.tsx, line 194)
```typescript
}, 5000); // Change to desired milliseconds
```
Current: 5 seconds (5000ms)
Options: 3000 (3s), 10000 (10s), 30000 (30s), etc.

### Badge Styling (Layout.tsx, line 86-88)
Color: `bg-red-500` → Change to `bg-amber-500`, `bg-rose-500`, etc.
Size: `h-5 w-5` → Change to `h-6 w-6` (larger) or `h-4 w-4` (smaller)
Text: `text-[10px]` → Change to `text-xs`, `text-sm`, etc.

### Role-Based Logic (notificationBadgeService.ts, lines 24-40)
Add new conditions or change filtering criteria:
- Change `status === 'pending'` to other values
- Add filters like `approved: false`
- Include/exclude based on timestamps

---

## Error Handling

All three files include error handling:

1. **notificationBadgeService.ts**: Pure functions, no errors
2. **Layout.tsx**: Defaults to {0,0,0} if no prop
3. **App.tsx**: Try-catch in polling, logs to console

Console messages:
- `'Error polling database:', error` - Network or parsing error
- Normal: No console messages unless error occurs

---

## Performance Optimizations

1. **useMemo**: Avoids recalculating badges unnecessarily
2. **Conditional polling**: Only runs when logged in
3. **Cleanup**: Proper interval cleanup prevents memory leaks
4. **Efficient filtering**: Uses `.filter().length` for counting
5. **Type safety**: TypeScript prevents runtime errors

---

## Browser Compatibility

All features use standard APIs:
- `setInterval/clearInterval` - Widely supported
- `fetch API` - Supported in all modern browsers
- `useEffect` - React hook, built-in
- `useMemo` - React hook, built-in
- CSS: Tailwind classes - Compiled to CSS

No special polyfills needed.

---

## Testing Checklist

- [ ] Admin sees Sales badge for pending sales
- [ ] Admin sees Withdraw badge for pending withdrawals
- [ ] Employee sees Announcements badge only
- [ ] Badges update within 5 seconds of database change
- [ ] Badges disappear when counts reach 0
- [ ] Polling stops on logout
- [ ] No errors in console
- [ ] Works on mobile viewport
- [ ] No memory leaks (check DevTools)
- [ ] Multiple windows sync correctly
