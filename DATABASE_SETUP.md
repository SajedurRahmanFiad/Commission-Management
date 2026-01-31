# Real-Time Database Integration Setup

## Overview

The Commission Management system supports two persistence modes:

- Supabase (recommended) — preferred for production/demo with persistence across restarts.
- Local in-memory / JSON (development fallback) — used when SUPABASE env vars are not configured.

If Supabase is configured via environment variables, the server will persist data into the configured Supabase project and Storage bucket. If not configured, the server will continue to operate with an in-memory fallback (non-persistent) to preserve developer experience.

> Tip: For local development with persistence, set up a Supabase project and add the required tables (see "Supabase schema" section below).

## Architecture

### Backend Server (`server.ts`)
- **Express.js** server running on port `5000`
- Handles all `/api/db` requests from the frontend
- **Never overwrites** complete files - only appends new data or updates specific records
- Manages data persistence to JSON files in the `/database` folder

### Frontend Service (`services/databaseService.ts`)
- Provides a clean interface for API calls
- Functions for fetching, appending, and updating data
- All data mutations (create, update) sync to the backend

### Database Files
Located in `/database/`:
- `users.json` - User accounts and profiles
- `sales.json` - Sales records
- `products.json` - Product catalog
- `announcements.json` - Announcements
- `withdrawals.json` - Withdrawal requests

## How It Works

### 1. Data Fetching (On App Load)
```typescript
// Happens automatically when the app starts
const dbData = await fetchDatabaseState();
// Returns fresh data from JSON files
```

### 2. Creating New Data (Append-Only)
When a sale is created:
```typescript
const newSale = { id, employeeId, amount, ... };

// Updates frontend state immediately
setState(prev => ({ ...prev, sales: [newSale, ...prev.sales] }));

// Appends to database/sales.json
await appendSale(newSale);
```

New sales are **prepended** to the sales array (newest first).

### 3. Updating Existing Data
When a sale is approved:
```typescript
// Updates the specific sale record
const updatedSale = { ...sale, status: 'completed' };
await updateSale(updatedSale);
```

This finds the matching sale by ID and updates only that record.

## Functions Available

### Read Operations
- `fetchDatabaseState()` - Get all data from database files

### Append Operations (New Records)
- `appendSale(saleData)` - Add new sale
- `appendWithdrawal(withdrawalData)` - Add new withdrawal
- `appendAnnouncement(announcementData)` - Add new announcement

### Update Operations (Modify Existing Records)
- `updateSale(saleData)` - Update a specific sale by ID
- `updateUser(userData)` - Update or create a user
- `updateProducts(productsArray)` - Replace all products
- `syncStateToDatabase(state)` - Full database sync (use sparingly)

## Installation & Running

### 1. Install Dependencies
```bash
npm install
```

This installs:
- `express` - Backend server
- `cors` - Cross-origin requests
- `tsx` - TypeScript runtime
- `concurrently` - Run multiple processes

### 2. Start Both Frontend & Backend
```bash
npm run dev:full
```

This runs:
- Backend server on `http://localhost:5000`
- Frontend dev server on `http://localhost:3000`

### 3. Or Run Separately
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run dev
```

## Data Flow Example: Creating a Sale

1. **User submits form** in frontend
2. **createSale()** is called
3. **New sale object created** with unique ID
4. **Frontend state updated** immediately (for responsive UI)
5. **appendSale()** calls API endpoint
6. **Backend** receives the request
7. **Reads** current sales.json
8. **Prepends** new sale to array
9. **Writes** back to sales.json (with 2-space formatting for readability)
10. **Response sent** to frontend
11. **Toast message** shows success

## Data Structure Examples

### sales.json
```json
[
  {
    "id": "abc123",
    "employeeId": "emp1",
    "employeeEmail": "john@company.com",
    "customerEmail": "customer@example.com",
    "amount": 5000,
    "productId": "p1",
    "status": "pending",
    "timestamp": "2026-01-29T10:30:00.000Z"
  }
]
```

### users.json
```json
[
  {
    "id": "1",
    "email": "admin@system.com",
    "password": "admin",
    "role": "admin",
    "wallet": 50000,
    "totalSalesCount": 150,
    "bkash_number": "0123456789",
    "nagad_number": "01700000000",
    "rocket_number": "01900000000",
    "notifications": []
  }
]
```

## Key Features

✅ **Append-Only** - New data never overwrites existing data  
✅ **Real-Time** - Changes appear immediately in the frontend  
✅ **Persistent** - All data saved to JSON files  
✅ **Traceable** - Each record has a timestamp  
✅ **Responsive** - Frontend updates before backend sync completes  
✅ **Auto-Seeding** - Creates default admin if database is empty  

## Database Integrity

- Files are written with proper JSON formatting (2-space indent)
- All reads include error handling with fallbacks
- If a file is corrupted, the app will log an error and use defaults
- Each operation logs success/failure to console

## API Endpoints

### GET /api/db
Returns all data from the database files.

**Response:**
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

**Body:**
```json
{
  "action": "APPEND_SALE",
  "payload": { /* sale object */ }
}
```

**Valid actions:**
- `APPEND_SALE` - Add new sale
- `APPEND_WITHDRAWAL` - Add new withdrawal
- `APPEND_ANNOUNCEMENT` - Add new announcement
- `UPDATE_SALE` - Update existing sale
- `UPDATE_USER` - Update/create user
- `UPDATE_PRODUCT` - Replace products list
- `SYNC_STATE` - Full sync (use carefully)

## Troubleshooting

### Backend not connecting
1. Verify `npm run server` is running
2. Check port 5000 isn't in use: `netstat -ano | findstr :5000`
3. Check for firewall issues

### Data not persisting
1. Verify `/database` folder exists
2. Check file permissions on database folder
3. Look for error messages in server console

### Frontend shows stale data
1. Hard refresh (Ctrl+Shift+R in Chrome)
2. Check browser console for fetch errors
3. Verify backend is running and responsive

## Supabase schema (recommended)

If you plan to use Supabase for persistence, create the following tables (example SQL). Adjust types to match your project conventions.

```sql
-- profiles
create table profiles (
  id text primary key,
  email text unique not null,
  password text,
  username text,
  avatar text,
  role text default 'employee',
  wallet numeric default 0,
  total_sales_count integer default 0,
  notifications jsonb default '[]'
);

-- products
create table products (
  id text primary key,
  name text,
  description text,
  pricing_model text,
  admin_share numeric,
  commission_percent numeric,
  gallery jsonb default '[]'
);

-- sales
create table sales (
  id text primary key,
  employee_id text,
  employee_email text,
  customer_email text,
  customer_phone text,
  product_id text,
  product_name text,
  amount numeric,
  status text,
  timestamp timestamptz
);

-- announcements
create table announcements (
  id text primary key,
  title text,
  content text,
  timestamp timestamptz,
  seen_by jsonb default '[]'
);

-- withdraw_requests
create table withdraw_requests (
  id text primary key,
  employee_id text,
  employee_email text,
  amount numeric,
  method text,
  account_number text,
  status text,
  timestamp timestamptz
);
```

Ensure the `profiles` table includes a `password` column if you want to support plaintext demo logins (NOT recommended for production). For production, use Supabase Auth and avoid storing plaintext passwords.

## Future Enhancements

- Add backup/restore functionality
- Implement transaction logging
- Add data validation before writes
- Database migration tools
- Real-time WebSocket updates (instead of polling)
