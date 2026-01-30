# Quick Reference

## Essential Commands

### First Time Setup
```bash
npm install                    # Install all dependencies
npm run dev:full              # Start frontend & backend together
```

### Running the App
```bash
npm run dev:full              # Run both servers (RECOMMENDED)
npm run server                # Run backend only
npm run dev                   # Run frontend only
npm run build                 # Build for production
npm run preview               # Preview production build
```

### Testing
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Health Check: http://localhost:5000/health

### Login Credentials
```
Email: admin@system.com
Password: admin
```

---

## Data Operations

### Create (Append) Operations
```typescript
import { appendSale, appendWithdrawal, appendAnnouncement } from './services/databaseService';

// Append a new sale
const result = await appendSale({
  id: "unique-id",
  employeeId: "emp1",
  amount: 5000,
  productId: "p1",
  status: "pending",
  timestamp: new Date().toISOString()
});
```

### Read Operations
```typescript
import { fetchDatabaseState } from './services/databaseService';

// Get all data
const data = await fetchDatabaseState();
// Returns: { users, sales, products, announcements, withdrawRequests, adminWallet }
```

### Update (By ID) Operations
```typescript
import { updateSale, updateUser, updateProducts } from './services/databaseService';

// Update a specific sale
const updated = await updateSale({
  ...sale,
  status: 'completed'
});

// Update user
const userUpdated = await updateUser({
  ...user,
  wallet: 10000
});

// Replace all products
const productsUpdated = await updateProducts([...products]);
```

---

## File Locations

```
Commission-Management/
├── server.ts                 # Backend server
├── App.tsx                   # Main frontend
├── services/
│   └── databaseService.ts    # Database API layer
├── database/                 # Data storage
│   ├── users.json
│   ├── sales.json
│   ├── products.json
│   ├── withdrawals.json
│   └── announcements.json
├── DATABASE_SETUP.md         # Architecture docs
├── SETUP_INSTRUCTIONS.md     # Setup guide
└── IMPLEMENTATION_SUMMARY.md # This document
```

---

## API Endpoints

### GET /api/db
Returns all data from JSON files.

```bash
curl http://localhost:5000/api/db
```

Response:
```json
{
  "users": [...],
  "sales": [...],
  "products": [...],
  "announcements": [...],
  "withdrawRequests": [...],
  "adminWallet": 50000
}
```

### POST /api/db
Perform database operations.

```bash
curl -X POST http://localhost:5000/api/db \
  -H "Content-Type: application/json" \
  -d '{
    "action": "APPEND_SALE",
    "payload": { "id": "...", "amount": 5000, ... }
  }'
```

Valid actions:
- `APPEND_SALE`
- `APPEND_WITHDRAWAL`
- `APPEND_ANNOUNCEMENT`
- `UPDATE_SALE`
- `UPDATE_USER`
- `UPDATE_PRODUCT`
- `SYNC_STATE`

---

## Database Operations Map

| What | Frontend Function | Backend Action | File |
|------|------------------|-----------------|------|
| Create Sale | `createSale()` | `APPEND_SALE` | sales.json |
| Approve Sale | `approveSale()` | `UPDATE_SALE` | sales.json |
| Request Withdrawal | `requestWithdraw()` | `APPEND_WITHDRAWAL` | withdrawals.json |
| Complete Withdrawal | `completeWithdraw()` | `UPDATE_SALE` | withdrawals.json |
| Create Product | `manageProduct()` | `UPDATE_PRODUCT` | products.json |
| Update User | `updateProfile()` | `UPDATE_USER` | users.json |

---

## Common Debugging

### Check Backend is Running
```bash
curl http://localhost:5000/health
# Should return: { "status": "ok", "message": "Backend server is running" }
```

### View Recent Database Activity
Check server console output:
```
Successfully wrote to sales.json
Successfully wrote to users.json
```

### Verify Data Saved
```bash
cat database/sales.json    # View sales (Mac/Linux)
type database\sales.json   # View sales (Windows)
```

### Clear All Data
```bash
rm database/*.json         # Delete all JSON files (Mac/Linux)
del database\*.json        # Delete all JSON files (Windows)
# Restart server - will recreate with defaults
```

### Change Server Port
In `server.ts`, line 6:
```typescript
const PORT = 3001;  // Changed from 5000
```

Then update `vite.config.ts` to match:
```typescript
target: 'http://localhost:3001',
```

---

## Data Structure Reference

### User Schema
```json
{
  "id": "string",
  "email": "string",
  "password": "string",
  "role": "admin" | "employee",
  "wallet": number,
  "totalSalesCount": number,
  "notifications": [],
  "username": "string?",
  "avatar": "string?",
  "paymentAccounts": "object?"
}
```

### Sale Schema
```json
{
  "id": "string",
  "employeeId": "string",
  "employeeEmail": "string",
  "customerEmail": "string",
  "customerPhone": "string",
  "amount": number,
  "productId": "string",
  "productName": "string",
  "paymentMethod": "bKash" | "Nagad" | "Rocket",
  "status": "pending" | "completed",
  "timestamp": "ISO string",
  "approvedAt": "ISO string?"
}
```

### Product Schema
```json
{
  "id": "string",
  "name": "string",
  "adminShare": number,
  "description": "string",
  "gallery": [],
  "mainImage": "string?"
}
```

### Withdrawal Schema
```json
{
  "id": "string",
  "employeeId": "string",
  "employeeEmail": "string",
  "amount": number,
  "method": "bKash" | "Nagad" | "Rocket",
  "accountNumber": "string",
  "status": "pending" | "completed",
  "timestamp": "ISO string"
}
```

---

## Performance Notes

- **Frontend State**: Updates instantly (optimistic updates)
- **Backend Sync**: Happens in background with no blocking
- **File I/O**: Synchronous (safe for small datasets)
- **Scalability**: Good for <10,000 records per file

For larger datasets, consider:
- Migrating to MongoDB/PostgreSQL
- Implementing pagination
- Using WebSockets for real-time sync

---

## Backup & Recovery

### Backup Data
```bash
cp -r database database.backup    # Mac/Linux
xcopy database database.backup /E # Windows
```

### Restore Data
```bash
rm -rf database                   # Delete current
cp -r database.backup database    # Restore from backup
npm run server                    # Restart
```

### Export to CSV (for sales)
Use any JSON to CSV converter online or:
```bash
npm install json2csv -g
json2csv -i database/sales.json -o sales.csv
```

---

## Monitoring

### Monitor File Changes
```bash
# Mac/Linux
watch 'ls -la database/'

# Windows PowerShell
while($true) { Get-ChildItem database\ | Format-Table LastWriteTime, Name; Start-Sleep 1 }
```

### Monitor API Requests
Open browser DevTools (F12) → Network tab → Filter "api/db"

### Monitor Server Logs
In terminal running `npm run server`, watch for:
- `Successfully wrote to [file].json`
- Error messages
- Health check responses

---

## Environment Variables

### .env.local
```
GEMINI_API_KEY=your_key_here
```

No additional env vars needed for database operations.

---

## Useful npm Scripts

```json
{
  "dev": "vite",                              // Frontend only
  "server": "tsx watch server.ts",            // Backend only
  "dev:full": "concurrently \"npm run server\" \"npm run dev\"",  // Both
  "build": "vite build",                      // Production build
  "preview": "vite preview"                   // Preview build
}
```

---

## Getting Help

1. Check logs in both frontend and backend terminals
2. Open browser DevTools (F12) → Console and Network tabs
3. Verify backend is running: `curl http://localhost:5000/health`
4. Check `/database` folder has all 5 JSON files
5. See `SETUP_INSTRUCTIONS.md` for detailed troubleshooting

---

**Remember:** 
- Always run `npm run dev:full` for development
- Check `npm run server` logs when debugging data issues
- All data is in `/database/*.json` - plain text, human-readable
