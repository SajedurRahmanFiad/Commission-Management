# Unseen Announcements Tracking - Implementation Guide

## Overview

The announcements badge for employees now tracks which announcements they have actually **seen** (scrolled into view). The badge only shows counts of unseen announcements, and automatically updates when an employee scrolls an announcement into view.

---

## How It Works

### 1. **Announcement Structure**
Each announcement now includes a `seenBy` field:
```typescript
interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  seenBy?: string[];  // Array of user IDs who have seen this
}
```

### 2. **Visibility Detection**
When an employee views the announcements:
- **IntersectionObserver** monitors when announcements appear on screen
- When an announcement becomes 10% visible, it's marked as seen
- The employee's ID is added to `seenBy` array
- Database is updated automatically
- Badge count decreases

### 3. **Badge Calculation**
For employees, the badge now counts:
```
Unseen Announcements = Total Announcements - Announcements already seen by current user
```

### 4. **Visual Indicators**
- **Unseen announcements**: Light blue background, blue left border, blue dot indicator
- **Seen announcements**: Gray left border, normal background, no indicator

---

## Files Modified

### 1. `types.ts`
- Updated `Announcement` interface to include `seenBy?: string[]`

### 2. `services/notificationBadgeService.ts`
- Updated `calculateBadgeCounts()` to accept `userId` parameter
- For employees: counts only announcements where `!seenBy.includes(userId)`
- Updated `hasPendingItems()` to pass userId

### 3. `services/databaseService.ts`
- Added `updateAnnouncement()` function to update announcements in database
- Supports UPDATE_ANNOUNCEMENT action

### 4. `components/views/AnnouncementView.tsx`
- Added IntersectionObserver setup
- Detects when announcements come into viewport (10% visible)
- Calls `onMarkSeen` callback when announcement is viewed
- Shows visual indicators (blue dot, background color) for unseen
- Accepts `onMarkSeen` prop

### 5. `App.tsx`
- Updated badge calculation to pass `state.currentUser.id`
- Added `onMarkSeen` handler to update announcements in state
- Updated new announcements to include `seenBy: []` array

---

## User Experience

### For Employees
1. **Badge appears**: See unread announcement badge on "Announcements" tab
2. **Navigate to tab**: Click "Announcements" 
3. **Scroll announcement into view**: As you scroll down, unseen announcements have:
   - Light blue background
   - Blue left border
   - Small blue dot next to title
4. **Announcement becomes visible**: IntersectionObserver detects it
5. **Automatic marking**: Announcement is marked as seen
6. **Badge updates**: Count decreases by 1
7. **Visual change**: Background becomes normal, indicator disappears

### For Admins
- No change to admin behavior
- Can still broadcast announcements
- New announcements have `seenBy: []`

---

## Technical Details

### IntersectionObserver Configuration
```javascript
{
  threshold: 0.1  // Triggers when 10% of element is visible
}
```

### Mark as Seen Process
1. Announcement scrolls into view
2. IntersectionObserver detects intersection
3. Employee ID added to `seenBy` array
4. `updateAnnouncement()` called to persist to database
5. `onMarkSeen` callback updates state
6. Component re-renders with updated badge
7. Observer stops observing that element

### State Updates
When announcement is seen:
```typescript
{
  ...announcement,
  seenBy: [...(announcement.seenBy || []), currentUser.id]
}
```

---

## Database Changes

### announcements.json Structure
```json
[
  {
    "id": "announcement-1",
    "title": "Important Update",
    "content": "...",
    "timestamp": "2026-01-30T10:00:00.000Z",
    "seenBy": ["user-id-1", "user-id-2"]  // NEW
  }
]
```

### API Update
Server must handle `UPDATE_ANNOUNCEMENT` action:
```json
{
  "action": "UPDATE_ANNOUNCEMENT",
  "payload": {
    "id": "announcement-1",
    "title": "...",
    "content": "...",
    "timestamp": "...",
    "seenBy": ["user-id-1", "user-id-2"]
  }
}
```

---

## Visual Indicators

### Unseen Announcement (Employee View)
```
┌─────────────────────────────────────┐
│ Title with blue dot ●               │ ← Blue dot
│ Light blue background               │ ← Light blue bg
│ Blue left border                    │ ← Blue border
│                                     │
│ Content here...                     │
└─────────────────────────────────────┘
```

### Seen Announcement (Employee View)
```
┌─────────────────────────────────────┐
│ Title                               │ ← No dot
│ Normal background                   │ ← Normal bg
│ Gray left border                    │ ← Gray border
│                                     │
│ Content here...                     │
└─────────────────────────────────────┘
```

### Admin View
```
Same styling for all announcements (no visual difference)
```

---

## Edge Cases Handled

1. **Announcement already seen**
   - Observer is immediately unobserved
   - No duplicate database updates

2. **User logs out and back in**
   - Fresh state load from database
   - `seenBy` array is preserved
   - Badge recalculates correctly

3. **Multiple users viewing same announcement**
   - Each user's ID tracked separately
   - Concurrent updates handled by server

4. **New announcement created**
   - `seenBy: []` initialized when created
   - All employees see as unseen
   - Badge updates for all

5. **Announcement scrolled out of view**
   - Observer continues monitoring
   - Only marks as seen once when visible

---

## Performance Considerations

- **Memory**: IntersectionObserver efficient, reuses single instance
- **Database Calls**: One API call per announcement per user per session
- **Re-renders**: Minimal, only when badge count changes
- **Scroll Performance**: No scroll event listeners, uses Observer API

---

## Testing Scenarios

### Scenario 1: Basic Flow
1. Employee logs in
2. Admin creates announcement
3. Employee sees badge on Announcements tab
4. Employee scrolls to announcement
5. Badge count decreases
6. Announcement appears as seen (gray border, no dot)
✅ PASS

### Scenario 2: Multiple Announcements
1. Admin creates 3 announcements
2. Employee sees badge "3"
3. Employee scrolls to first two
4. Badge updates to "1"
5. Only third shows as unseen (blue background)
✅ PASS

### Scenario 3: Session Persistence
1. Employee marks announcements as seen
2. Closes browser
3. Logs back in
4. Announcements still show as seen
5. Badge count preserved
✅ PASS

### Scenario 4: Multi-User
1. Employee A sees badge "1"
2. Employee A marks seen
3. Employee B still sees badge "1" (different user)
4. Each tracked independently
✅ PASS

### Scenario 5: Admin View
1. Admin creates announcement
2. Admin views Announcements tab
3. No unseen indicator shown (no blue dots/background)
4. No badge appears
✅ PASS

---

## Backward Compatibility

- Existing announcements without `seenBy` field work fine
- `seenBy?.includes()` safely handles undefined
- Old database entries auto-migrate on first view

---

## Code Examples

### Check if Announcement is Seen
```typescript
const isSeen = announcement.seenBy?.includes(currentUser.id);
```

### Mark as Seen (Client)
```typescript
const updatedAnnouncement = {
  ...announcement,
  seenBy: [...(announcement.seenBy || []), userId]
};
await updateAnnouncement(updatedAnnouncement);
```

### Calculate Unseen Count
```typescript
const unseenCount = announcements.filter(a => 
  !a.seenBy?.includes(userId)
).length;
```

---

## Future Enhancements

1. **Mark All as Read**: Button to mark all announcements as seen
2. **Batch Operations**: More efficient bulk updates
3. **Seen Timeline**: Show when each user saw announcement
4. **Unread Count Only**: Option to hide seen announcements
5. **Notifications**: Optional email/push when new announcement
6. **Search Seen/Unseen**: Filter by seen status

---

## Troubleshooting

### Badge Not Updating
- Check browser console for errors
- Verify UPDATE_ANNOUNCEMENT endpoint is working
- Ensure announcement data includes `seenBy` field
- Clear browser cache and reload

### Announcement Not Marking as Seen
- Verify IntersectionObserver is supported (all modern browsers)
- Check threshold value (currently 0.1 = 10% visible)
- Verify `onMarkSeen` callback is connected
- Check network tab for UPDATE_ANNOUNCEMENT calls

### Seen Status Lost After Refresh
- Verify database is persisting updates
- Check that `updateAnnouncement()` is being called
- Verify response status is 200 OK
- Check server logs for errors

---

## API Endpoint Update

Your `/api/db` endpoint needs to handle:

```typescript
{
  "action": "UPDATE_ANNOUNCEMENT",
  "payload": {
    "id": "announcement-id",
    "title": "...",
    "content": "...",
    "timestamp": "...",
    "seenBy": ["user-id"]
  }
}
```

This should:
1. Find announcement by ID
2. Update `seenBy` field
3. Write back to `announcements.json`
4. Return success response

---

## Summary

✅ **Automatic Detection**: Announcements marked as seen when scrolled into view
✅ **Smart Badge**: Shows only unseen count for employees
✅ **Visual Feedback**: Unseen announcements highlighted in blue
✅ **Persistent**: Survives page refresh and re-login
✅ **Efficient**: Uses native IntersectionObserver API
✅ **User-Friendly**: No manual "mark as read" needed
