# Setup Instructions for Real-Time Database

## What Was Changed

Your Commission Management system has been upgraded with a real-time database system that uses JSON files for persistent storage. Here's what's new:

### New Files Created
1. **`services/databaseService.ts`** - Service layer for all database operations
2. **`server.ts`** - Express.js backend server handling API requests
3. **`DATABASE_SETUP.md`** - Comprehensive database documentation

### Modified Files
1. **`App.tsx`**
   - Added import for databaseService
   - Added `useEffect` hook to fetch data from database on app load
   - Updated all data mutation functions to sync with backend
   - All creates/updates now append to JSON files instead of just local state

2. **`package.json`**
   - Added `express` dependency (backend server)
   - Added `cors` dependency (cross-origin requests)
   - Added `@types/express` and `@types/cors` (TypeScript types)
   - Added `tsx` (TypeScript runtime)
   - Added `concurrently` (run multiple processes)
   - Added new scripts: `server` and `dev:full`

3. **`vite.config.ts`**
   - Added proxy configuration to route API calls to backend server

4. **`README.md`**
   - Updated with new setup instructions and features

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

This will install all new backend dependencies.

### 2. Verify Directory Structure
Ensure your `/database` folder exists with these files:
- `users.json` (contains default admin)
- `products.json` (product catalog)
- `sales.json` (empty or existing sales)
- `withdrawals.json` (empty or existing withdrawals)
- `announcements.json` (empty or announcements)

These files will be auto-created if they don't exist.

### 3. Start the Application

**Option A: Run Both Frontend & Backend Together** (Recommended)
```bash
npm run dev:full
```

This starts both servers in parallel:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

**Option B: Run Separately**
```bash
# Terminal 1
npm run server

# Terminal 2
npm run dev
```

## How Data Flows Now

### Reading Data
```
Frontend → Browser Cache/State
         → API Request to Backend
         → Backend reads from JSON files
         → Returns to Frontend
```

### Writing Data (Creating)
```
Frontend → Updates Local State (instant UI update)
         → API Request to Backend
         → Backend APPENDS to JSON file
         → Saves and confirms
         → Toast shows success
```

### Writing Data (Updating)
```
Frontend → Updates Local State
         → API Request to Backend
         → Backend FINDS matching record by ID
         → REPLACES only that record
         → Saves JSON file
         → Confirms to Frontend
```

## Key Benefits

✅ **No Data Loss** - Everything is appended, never overwritten  
✅ **Audit Trail** - Every transaction is logged with timestamp  
✅ **Real-Time** - Frontend updates immediately, backend syncs after  
✅ **Persistent** - Survives browser refresh and server restarts  
✅ **Simple** - Plain JSON files, easy to inspect and backup  

## Testing the Setup

1. **Login** with admin@system.com / admin
2. **Create a Sale** - Should appear in both UI and `database/sales.json`
3. **Approve a Sale** - Updates the sale record in the database
4. **Create a Withdrawal** - Appended to `database/withdrawals.json`
5. **Manage Products** - Changes saved to `database/products.json`

Check the JSON files in `/database` to verify data is being saved.

## Debugging

### Check Backend Connection
Open browser console (F12) and check Network tab. API requests to `/api/db` should show status 200.

### View Database Files
Open any JSON file in the `/database` folder to verify data is being saved.

### Check Server Logs
If running `npm run server`, you'll see logs like:
```
🚀 Backend server running on http://localhost:5000
Successfully wrote to sales.json
```

### Reset Database
Delete the JSON files in `/database` and restart the server. It will auto-create them with default data.

## Troubleshooting

**"Cannot find module 'express'"**
- Run `npm install` again
- Delete `node_modules` folder and run `npm install`

**"EADDRINUSE :::5000"**
- Port 5000 is already in use
- Kill process: `npx lsof -i :5000` (Mac/Linux) or `netstat -ano | findstr :5000` (Windows)
- Or change port in `server.ts` line 6: `const PORT = 5001;`

**"Cannot GET /api/db"**
- Backend server is not running
- Run `npm run server` in another terminal

**Data not showing up**
- Hard refresh browser (Ctrl+Shift+R)
- Check browser console for fetch errors
- Verify backend is responding: visit http://localhost:5000/health

## Next Steps

1. **Backup Existing Data** - Copy your `/database` folder before major changes
2. **Test Workflows** - Create sales, approve them, request withdrawals
3. **Deploy** - When ready, run `npm run build` for production
4. **Monitor** - Keep an eye on `/database` files and server logs

## Support

Refer to `DATABASE_SETUP.md` for detailed API documentation and architecture overview.

---

**Everything is ready to go!** Run `npm run dev:full` to start both servers.
