# Unseen Announcements - Quick Reference

## What's New ✨

Announcements badge now shows **unseen count** and automatically marks as seen when scrolled into view.

---

## Visual Changes

### Unseen Announcement (for Employees)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Title ●                            ┃  ← Blue dot
┃ (light blue background)            ┃
┃ Blue left border                   ┃
┃                                    ┃
┃ Content...                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

### Seen Announcement (for Employees)
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Title                              ┃  ← No dot
┃ (normal background)                ┃
┃ Gray left border                   ┃
┃                                    ┃
┃ Content...                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## Badge Behavior

### Before (Old)
```
Announcements ❌ (5)  ← Total of all announcements
```

### After (New)
```
Announcements ❌ (2)  ← Only unseen announcements
```

---

## How to Use (Employee)

1. **See Badge**: Announcements ❌ (3) on tab
2. **Click Tab**: Navigate to Announcements
3. **Scroll Down**: View announcement
4. **Auto-Mark**: When 10% visible, auto-marked as seen
5. **Visual Change**: Background changes from blue to gray
6. **Badge Decreases**: Count goes 3 → 2 → 1 → 0
7. **Done**: No manual "mark as read" needed

---

## How to Broadcast (Admin)

1. **Go to Announcements**
2. **Fill Subject and Message**
3. **Click Announce**
4. **All employees see badge increase**
5. **They mark as seen by viewing**

---

## Database Changes

### New Field in announcements.json
```json
{
  "id": "ann-001",
  "title": "Update",
  "content": "Content",
  "timestamp": "2026-01-30T10:00:00Z",
  "seenBy": ["user-1", "user-3"]  ← NEW
}
```

---

## Code Changes Summary

| File | Change |
|------|--------|
| `types.ts` | Added `seenBy?: string[]` to Announcement |
| `notificationBadgeService.ts` | Updated badge logic for unseen only |
| `databaseService.ts` | Added `updateAnnouncement()` |
| `AnnouncementView.tsx` | Added IntersectionObserver |
| `App.tsx` | Updated badge calc & added handler |

---

## Server Requirements

### Support UPDATE_ANNOUNCEMENT Action

```json
{
  "action": "UPDATE_ANNOUNCEMENT",
  "payload": { /* announcement with seenBy */ }
}
```

**Endpoint**: `/api/db` (existing)
**Response**: 200 OK

---

## Testing Checklist

- [ ] Badge shows unseen count (not total)
- [ ] Scrolling announcement marks as seen
- [ ] Badge decreases as you view
- [ ] Visual change: blue → gray
- [ ] Blue dot disappears when seen
- [ ] Status persists on page refresh
- [ ] Admin doesn't see indicators
- [ ] Multi-user: independent counts

---

## Common Issues

### Badge Not Decreasing
✓ Check network tab for UPDATE_ANNOUNCEMENT calls
✓ Verify announcement is 10% visible
✓ Check browser console for errors

### Seen Status Lost on Refresh
✓ Verify server saves UPDATE_ANNOUNCEMENT
✓ Check announcements.json has seenBy field
✓ Verify API returns 200 OK

### No Visual Indicators
✓ Clear browser cache: Ctrl+Shift+R
✓ Check CSS not overridden
✓ Verify isAdmin flag is correct

---

## Customization

### Change Visibility Threshold
**File**: `AnnouncementView.tsx` line 28
```typescript
{ threshold: 0.1 }  // 0.1 = 10% visible, 0.5 = 50%, etc
```

### Change Colors
**File**: `AnnouncementView.tsx` line 63-67
```
Unseen border: border-l-indigo-600
Seen border: border-l-slate-300
Unseen bg: bg-indigo-50/30
```

---

## FAQ

**Q: Can I see who viewed an announcement?**
A: Yes, `seenBy` array stores user IDs. Future feature to display this.

**Q: Can I mark as unread?**
A: Currently no, but can be added as future feature.

**Q: Do admins see unseen indicators?**
A: No, only employees see them.

**Q: What if I refresh the page?**
A: Seen status is preserved from database. Refreshing doesn't reset it.

**Q: Does it work on mobile?**
A: Yes, IntersectionObserver works on all modern mobile browsers.

---

## Performance

- **Fast**: Native browser API (IntersectionObserver)
- **Efficient**: One DB update per announcement per user
- **Lightweight**: Minimal API calls (~1KB per update)
- **Smooth**: No scroll lag or performance issues

---

## What's Tracked

Database now tracks:
```
For each announcement:
  - Who has seen it (user IDs in seenBy array)
  - Badge shows: Total announcements - seen by current user
```

---

## Integration Checklist

- [ ] `types.ts` updated ✅
- [ ] `notificationBadgeService.ts` updated ✅
- [ ] `databaseService.ts` updated ✅
- [ ] `AnnouncementView.tsx` updated ✅
- [ ] `App.tsx` updated ✅
- [ ] Server supports UPDATE_ANNOUNCEMENT ⚠️ **YOU DO THIS**
- [ ] Database initialized with seenBy field ⚠️ **YOU DO THIS**

---

## Documentation Files

- `UNSEEN_ANNOUNCEMENTS_COMPLETE.md` - Full implementation details
- `UNSEEN_ANNOUNCEMENTS_GUIDE.md` - Technical guide
- `ANNOUNCEMENTS_BADGE_UPDATED.md` - User guide
- This file - Quick reference

---

**Status**: ✅ Client-side complete, awaits server UPDATE_ANNOUNCEMENT support
**Last Updated**: January 30, 2026
