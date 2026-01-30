# Announcements Badge - Updated Behavior

## Change Summary

The announcements badge for employees has been enhanced to track **unseen announcements** instead of all announcements.

---

## Before (Old Behavior)
```
Announcements Badge = Total number of announcements
```
- Badge shows: 5 (all announcements count)
- Employee sees same count regardless of which they've read
- No way to know which are new

---

## After (New Behavior)
```
Announcements Badge = Number of unseen announcements
```
- Badge shows: 2 (only unseen count)
- Employee scrolls announcement into view
- Automatically marked as seen
- Badge decreases: 2 → 1
- Visual indicator shows which are unseen (blue highlight)

---

## Key Features

### 1. **Automatic Detection**
- Uses IntersectionObserver API
- Detects when announcement enters viewport (10% visible)
- No manual "mark as read" button needed

### 2. **Visual Indicators for Employees**
- **Unseen**: Blue background, blue left border, small blue dot
- **Seen**: Gray left border, normal background

### 3. **Real-Time Badge Updates**
- Badge count decreases as you scroll
- Updates persist to database
- Survives page refresh

### 4. **Per-User Tracking**
- Each employee's seen status tracked independently
- Other employees don't affect your count
- Shared announcements but separate tracking

### 5. **Database Persistence**
- `seenBy` array stores user IDs who have seen announcement
- Updated when announcement scrolls into view
- Fetched on app reload

---

## For Employees

### What Changed
- Badge now shows **unseen count** not total count
- Announcements automatically marked as read when you view them
- Visual styles help distinguish unseen (blue) vs seen (gray)

### How to Use
1. Click "Announcements" tab
2. Badge shows unseen count (e.g., "3")
3. Scroll down to view announcements
4. As each announcement appears:
   - Background is light blue (unseen)
   - Small blue dot next to title
   - Crossing 10% visible threshold marks it as seen
5. Background turns gray, dot disappears
6. Badge count decreases

### Example Walkthrough
```
Initial state:
  Announcements ❌ (3)  ← 3 unseen

After scrolling to first announcement:
  Announcements ❌ (2)  ← 1 now marked as seen
  
After scrolling through all:
  Announcements       ← No badge, all seen
```

---

## For Admins

### No Changes Required
- Broadcast announcements as before
- New announcements initialized with `seenBy: []`
- Can see all announcements but no unseen indicator

### Create Announcement
```
1. Fill in Subject and Message
2. Click "Announce"
3. All employees see badge increase (if unseen)
```

---

## Database Structure

### Updated announcements.json
```json
[
  {
    "id": "ann-001",
    "title": "Important Update",
    "content": "Content here",
    "timestamp": "2026-01-30T10:00:00Z",
    "seenBy": ["user-1", "user-3"]  ← NEW: tracks who's seen it
  }
]
```

### Backward Compatible
- Old announcements without `seenBy` field still work
- Auto-treated as unseen for all users
- First view adds user to `seenBy` array

---

## API Updates Required

Your `/api/db` endpoint should handle:

### Update Announcement Action
```json
{
  "action": "UPDATE_ANNOUNCEMENT",
  "payload": {
    "id": "announcement-id",
    "title": "...",
    "content": "...",
    "timestamp": "...",
    "seenBy": ["user-id-1", "user-id-2"]
  }
}
```

---

## Testing Checklist

### As Employee
- [ ] Badge shows count of unseen announcements
- [ ] Scrolling announcement into view marks it as seen
- [ ] Badge count decreases as you view announcements
- [ ] Unseen announcements have blue background
- [ ] Seen announcements have gray background
- [ ] Blue dot appears on unseen, disappears when seen
- [ ] Closing and reopening app preserves seen status

### As Admin
- [ ] Can still broadcast announcements
- [ ] Announcements appear for all employees
- [ ] No unseen indicators on admin view

### Multi-User
- [ ] Two employees see independent badge counts
- [ ] One employee marking as seen doesn't affect others
- [ ] Each user's seen list is separate

---

## Migration Notes

If you have existing announcements without `seenBy`:

### Server-Side
When fetching announcements, ensure `seenBy` field exists:
```javascript
if (!announcement.seenBy) {
  announcement.seenBy = [];  // Initialize as empty
}
```

### Client-Side
Auto-handled by the code:
```typescript
announcement.seenBy?.includes(userId)  // Safely handles undefined
```

---

## Settings & Customization

### Change Visibility Threshold
**File**: `AnnouncementView.tsx`, line 28
```typescript
{ threshold: 0.1 }  // Change 0.1 to desired value
// 0.0 = any part visible
// 0.5 = 50% visible
// 1.0 = fully visible
```

### Change Visual Styling
**File**: `AnnouncementView.tsx`, lines 63-67
```typescript
className={`...${isSeen ? 'border-l-slate-300' : 'border-l-indigo-600 ...'}...`}
```
- Change `border-l-slate-300` (seen color)
- Change `border-l-indigo-600` (unseen color)

---

## Performance Impact

- **Minimal**: One API call per announcement per user per session
- **No scroll lag**: Uses native IntersectionObserver (very efficient)
- **Database**: One UPDATE_ANNOUNCEMENT call when announcement comes into view
- **Memory**: Single observer instance shared across all announcements

---

## FAQ

**Q: Can I mark an announcement as unread?**
A: Currently no. Each view auto-marks as seen. Future feature possible.

**Q: What if I share my account?**
A: They would share the same "seen" status since tracked by user ID.

**Q: Do admins see unseen indicators?**
A: No, admins don't see unseen dots/colors, announcements appear normal.

**Q: What if server fails to update?**
A: Update attempt is retried on next session. Manual database cleanup might be needed.

**Q: Are old announcements unseen?**
A: Only if they don't have `seenBy` field. They'll be treated as unseen.

---

## Summary

The announcements badge is now **smarter**:
- ✅ Tracks actual viewing (not just creation)
- ✅ Auto-marks as seen when scrolled into view
- ✅ Shows meaningful badge count (unseen only)
- ✅ Visual feedback (blue = unseen, gray = seen)
- ✅ Persistent across sessions

**Result**: Employees always know what's new without manual actions! 🎉
