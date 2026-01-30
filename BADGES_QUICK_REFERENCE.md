# Real-Time Badges - Quick Reference

## Feature Overview
Notification badges appear next to tab names showing counts of pending items that need attention.

## Badge Rules by User Role

### Admins See Badges For:
- **Sales Tab**: Number of pending (unverified) sales
- **Withdraw Tab**: Number of pending (incomplete) withdrawal requests

### Agents See Badges For:
- **Announcements Tab**: Number of announcements (all announcements are displayed)

## How It Works

1. **Real-time Polling**: App polls database every 5 seconds when user is logged in
2. **Automatic Updates**: Badges recalculate whenever data changes
3. **Smart Display**: Badges only show when count > 0
4. **Clean Cleanup**: Polling stops when user logs out

## Customization

### Change Polling Interval
Edit `App.tsx` line 194:
```typescript
}, 5000); // Change 5000 to desired milliseconds (e.g., 10000 for 10 seconds)
```

### Modify Badge Appearance
Edit badge styling in `Layout.tsx` lines 84-87:
```typescript
<span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
```

Options to customize:
- `h-5 w-5` = badge size
- `bg-red-500` = badge color
- `text-[10px]` = text size
- `rounded-full` = make oval with `rounded-lg` or square with `rounded-md`

### Add Badges to More Tabs
1. Edit `notificationBadgeService.ts` to add logic for new tab
2. Add case to badge count check in `Layout.tsx` Navigation component
3. Update `BadgeCounts` interface to include new property

## Example: Add Badge for Products Tab

### Step 1: Update `notificationBadgeService.ts`
```typescript
export interface BadgeCounts {
  sales: number;
  withdraw: number;
  announcements: number;
  products: number;  // Add this
}

// In calculateBadgeCounts():
if (userRole === 'admin') {
  // Count products marked as 'featured' or 'new'
  counts.products = products.filter(p => p.isNew).length;
}
```

### Step 2: Update `Layout.tsx` Navigation
```typescript
if (item.id === 'sales') badgeCount = badges.sales;
else if (item.id === 'withdraw') badgeCount = badges.withdraw;
else if (item.id === 'announcements') badgeCount = badges.announcements;
else if (item.id === 'products') badgeCount = badges.products;  // Add this
```

## Troubleshooting

### Badges Not Updating?
- Check browser console for polling errors
- Verify user is logged in (polling only runs when `currentUser` exists)
- Check database file permissions (ensure app can read from files)
- Try refreshing the page

### Badges Not Showing?
- Verify counts are > 0
- Check that `badgeCounts` prop is passed to Layout
- Look for CSS conflicts (check Tailwind classes)
- Verify role-based logic matches your data structure

### Performance Issues?
- Increase polling interval in App.tsx (e.g., 10000ms instead of 5000ms)
- Optimize database file sizes if very large
- Add debouncing if state updates are too frequent

## Database Fields Used

The feature watches for changes in these database fields:

**Sales**: `sales.json`
```json
{
  "status": "pending"  // or "completed"
}
```

**Withdrawals**: `database/withdrawals.json`
```json
{
  "status": "pending"  // or "completed"
}
```

**Announcements**: `announcements.json`
```json
{
  "id": "unique-id",
  "title": "...",
  "content": "..."
}
```

## Related Files

- `services/notificationBadgeService.ts` - Badge calculation logic
- `components/Layout.tsx` - Badge rendering in UI
- `App.tsx` - Polling implementation and badge prop passing
- `types.ts` - Type definitions for roles and data structures
