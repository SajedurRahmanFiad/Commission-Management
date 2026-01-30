<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Commission Management System

A full-stack commission and sales management platform with real-time database integration.

## Features

✅ **Real-Time Database** - Data synced to JSON files in real-time  
✅ **Append-Only Architecture** - Never overwrites existing data  
✅ **Admin & Employee Roles** - Different dashboards for admin and sales employees  
✅ **Sales Management** - Track, approve, and manage sales records  
✅ **Wallet System** - Employee commission tracking and withdrawals  
✅ **Product Catalog** - Dynamic product management with commission rates  
✅ **Notifications** - Real-time notification system  

## Run Locally

**Prerequisites:**
- Node.js (v16+)
- npm or yarn

### Quick Start (Run Both Frontend & Backend)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

3. Run both frontend and backend:
   ```bash
   npm run dev:full
   ```

   This starts:
   - **Frontend** on `http://localhost:3000`
   - **Backend** on `http://localhost:5000`

### Run Frontend & Backend Separately

**Terminal 1 - Backend Server:**
```bash
npm run server
```

**Terminal 2 - Frontend Dev Server:**
```bash
npm run dev
```

## Database Structure

All data is stored in the `/database` folder as JSON files:
- `users.json` - User accounts and profiles
- `sales.json` - Sales transactions
- `products.json` - Product catalog
- `announcements.json` - System announcements
- `withdrawals.json` - Withdrawal requests

For detailed information on the database setup, see [DATABASE_SETUP.md](DATABASE_SETUP.md).

## Default Credentials

**Admin Account:**
- Email: `admin@system.com`
- Password: `admin`

## Development

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Express.js + Node.js
- **Database**: JSON files with file-system persistence

## Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` folder.

## Project Structure

```
├── src/
│   ├── App.tsx              # Main app component
│   ├── components/          # React components
│   ├── services/            # API services
│   └── types.ts             # TypeScript types
├── database/                # JSON data files
├── server.ts                # Express backend
└── vite.config.ts           # Vite configuration
```

## API Documentation

See [DATABASE_SETUP.md](DATABASE_SETUP.md#api-endpoints) for complete API documentation.
