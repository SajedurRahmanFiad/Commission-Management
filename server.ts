import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Database path - relative to this server file
const DB_PATH = path.resolve(__dirname, './database');
const UPLOADS_PATH = path.resolve(DB_PATH, './uploads');
const AVATARS_PATH = path.resolve(UPLOADS_PATH, './avatars');
const PRODUCTS_PATH = path.resolve(UPLOADS_PATH, './product');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadType = req.query.type as string || 'product';
    const folder = uploadType === 'avatar' ? AVATARS_PATH : PRODUCTS_PATH;
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per file
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Ensure directory exists
if (!fs.existsSync(DB_PATH)) {
  try {
    fs.mkdirSync(DB_PATH, { recursive: true });
  } catch (e) {
    console.error("Critical: Could not create database directory", e);
  }
}

// Ensure upload directories exist
if (!fs.existsSync(AVATARS_PATH)) {
  try {
    fs.mkdirSync(AVATARS_PATH, { recursive: true });
  } catch (e) {
    console.error("Critical: Could not create avatars directory", e);
  }
}

if (!fs.existsSync(PRODUCTS_PATH)) {
  try {
    fs.mkdirSync(PRODUCTS_PATH, { recursive: true });
  } catch (e) {
    console.error("Critical: Could not create products directory", e);
  }
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_PATH));

// Serve database folder for direct access to uploads
app.use('/database', express.static(DB_PATH));

// Define default admin for recovery/seeding
const DEFAULT_ADMIN = {
  id: "1",
  email: "admin@system.com",
  password: "admin",
  role: "admin",
  wallet: 0,
  totalSalesCount: 0,
  notifications: []
};

// Helper functions
const readFile = (filename: string) => {
  const filePath = path.join(DB_PATH, `${filename}.json`);
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(data || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(`Error reading ${filename}:`, e);
    return [];
  }
};

const writeFile = (filename: string, data: any) => {
  const filePath = path.join(DB_PATH, `${filename}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Successfully wrote to ${filename}.json`);
  } catch (e) {
    console.error(`Error writing ${filename}:`, e);
  }
};

// FILE UPLOAD endpoint - handle image uploads for avatars and products
app.post('/api/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const uploadType = req.query.type as string || 'product';
    const fileUrl = `/database/uploads/${uploadType === 'avatar' ? 'avatars' : 'product'}/${req.file.filename}`;
    console.log(`File uploaded successfully to ${uploadType}: ${fileUrl}`);
    
    return res.status(200).json({ 
      success: true, 
      filePath: fileUrl,
      filename: req.file.filename 
    });
  } catch (error) {
    console.error("File upload error:", error);
    return res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET endpoint - fetch all data
app.get('/api/db', (req: Request, res: Response) => {
  try {
    let users = readFile('users');
    
    // Auto-Seed: If no users exist, provide and save the default admin.
    if (users.length === 0) {
      users = [DEFAULT_ADMIN];
      writeFile('users', users);
      console.log("Database seeded with default admin.");
    }

    const sales = readFile('sales');
    const products = readFile('products');
    const announcements = readFile('announcements');
    const withdrawals = readFile('withdrawals');

    // Get admin wallet from the admin user's wallet field (not calculated)
    const adminUser = users.find((u: any) => u.role === 'admin');
    const adminWallet = adminUser?.wallet || 0;
    console.log('Admin user wallet:', adminWallet, 'Admin user:', adminUser?.email);

    return res.status(200).json({
      users,
      sales,
      products,
      announcements,
      withdrawRequests: withdrawals,
      adminWallet
    });
  } catch (error) {
    console.error("GET DB Error:", error);
    return res.status(500).json({ error: 'Failed to read database' });
  }
});

// GET products - search by query ?q=
app.get('/api/products', (req: Request, res: Response) => {
  try {
    const products = readFile('products');
    const q = (req.query.q || '').toString().toLowerCase().trim();
    if (!q) return res.status(200).json(products);
    const filtered = products.filter((p: any) => {
      const name = (p.name || '').toLowerCase();
      const desc = (p.description || p.desc || '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
    return res.status(200).json(filtered);
  } catch (error) {
    console.error('GET /api/products error:', error);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET users - search by query ?q= and optional role param
app.get('/api/users', (req: Request, res: Response) => {
  try {
    let users = readFile('users');
    const q = (req.query.q || '').toString().toLowerCase().trim();
    const role = (req.query.role || '').toString();
    if (role) users = users.filter((u: any) => u.role === role);
    if (!q) return res.status(200).json(users);
    const filtered = users.filter((u: any) => {
      const email = (u.email || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      return email.includes(q) || username.includes(q);
    });
    return res.status(200).json(filtered);
  } catch (error) {
    console.error('GET /api/users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET sales - search by q (customer email/phone, product name, employee email/username)
app.get('/api/sales', (req: Request, res: Response) => {
  try {
    const sales = readFile('sales');
    const products = readFile('products');
    const users = readFile('users');
    const q = (req.query.q || '').toString().toLowerCase().trim();
    if (!q) return res.status(200).json(sales);
    const filtered = sales.filter((s: any) => {
      const custEmail = (s.customerEmail || '').toLowerCase();
      const custPhone = (s.customerPhone || '').toString().toLowerCase();
      const product = products.find((p: any) => p.id === s.productId) || {};
      const productName = (s.productName || product.name || '').toLowerCase();
      const emp = users.find((u: any) => u.id === s.employeeId) || users.find((u: any) => u.email === s.employeeEmail) || {};
      const empEmail = (emp.email || '').toLowerCase();
      const empName = (emp.username || '').toLowerCase();
      return custEmail.includes(q) || custPhone.includes(q) || productName.includes(q) || empEmail.includes(q) || empName.includes(q);
    });
    return res.status(200).json(filtered);
  } catch (error) {
    console.error('GET /api/sales error:', error);
    return res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET withdrawals - search by q (account number, agent email/username, status, amount)
app.get('/api/withdrawals', (req: Request, res: Response) => {
  try {
    const withdrawals = readFile('withdrawals');
    const users = readFile('users');
    const q = (req.query.q || '').toString().toLowerCase().trim();
    if (!q) return res.status(200).json(withdrawals);
    const filtered = withdrawals.filter((w: any) => {
      const acc = (w.accountNumber || '').toLowerCase();
      const status = (w.status || '').toLowerCase();
      const amount = (w.amount || '').toString().toLowerCase();
      const emp = users.find((u: any) => u.id === w.employeeId) || users.find((u: any) => u.email === w.employeeEmail) || {};
      const empEmail = (emp.email || '').toLowerCase();
      const empName = (emp.username || '').toLowerCase();
      return acc.includes(q) || status.includes(q) || amount.includes(q) || empEmail.includes(q) || empName.includes(q);
    });
    return res.status(200).json(filtered);
  } catch (error) {
    console.error('GET /api/withdrawals error:', error);
    return res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// POST endpoint - write/append data
app.post('/api/db', (req: Request, res: Response) => {
  const { action, payload } = req.body;
  console.log(`Received POST request - Action: ${action}`, payload);

  try {
    switch (action) {
      case 'SYNC_STATE':
        if (payload.users) writeFile('users', payload.users);
        if (payload.sales) writeFile('sales', payload.sales);
        if (payload.products) writeFile('products', payload.products);
        if (payload.announcements) writeFile('announcements', payload.announcements);
        if (payload.withdrawRequests) writeFile('withdrawals', payload.withdrawRequests);
        break;

      case 'APPEND_SALE':
        const currentSales = readFile('sales');
        writeFile('sales', [payload, ...currentSales]);
        break;

      case 'UPDATE_USER':
        const currentUsers = readFile('users');
        const userIndex = currentUsers.findIndex((u: any) => u.id === payload.id);
        if (userIndex > -1) {
          currentUsers[userIndex] = payload;
          writeFile('users', currentUsers);
        } else {
          // Check for duplicate emails before adding
          const emailExists = currentUsers.some((u: any) => u.email.toLowerCase() === payload.email.toLowerCase());
          if (!emailExists) {
            writeFile('users', [...currentUsers, payload]);
          } else {
            // If it exists but index was -1, maybe ID changed? Update by email.
            const idxByEmail = currentUsers.findIndex((u: any) => u.email.toLowerCase() === payload.email.toLowerCase());
            if (idxByEmail > -1) {
              currentUsers[idxByEmail] = payload;
              writeFile('users', currentUsers);
            }
          }
        }
        break;
        
      case 'APPEND_ANNOUNCEMENT':
        const currentAnns = readFile('announcements');
        writeFile('announcements', [payload, ...currentAnns]);
        break;

      case 'UPDATE_ANNOUNCEMENT':
        const announcementsToUpdate = readFile('announcements');
        writeFile('announcements', announcementsToUpdate.map((a: any) => a.id === payload.id ? payload : a));
        break;

      case 'DELETE_ANNOUNCEMENT':
        const announcementsToDelete = readFile('announcements');
        writeFile('announcements', announcementsToDelete.filter((a: any) => a.id !== payload.id));
        break;

      case 'APPEND_WITHDRAWAL':
        const currentWithdrawals = readFile('withdrawals');
        writeFile('withdrawals', [payload, ...currentWithdrawals]);
        break;
        
      case 'UPDATE_WITHDRAWAL':
        const withdrawalsToUpdate = readFile('withdrawals');
        writeFile('withdrawals', withdrawalsToUpdate.map((w: any) => w.id === payload.id ? payload : w));
        break;
        
      case 'UPDATE_SALE':
        const salesToUpdate = readFile('sales');
        writeFile('sales', salesToUpdate.map((s: any) => s.id === payload.id ? payload : s));
        break;

      case 'UPDATE_PRODUCT':
        writeFile('products', payload);
        break;
        
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("POST DB Write Error:", error);
    return res.status(500).json({ error: 'Failed to write to database' });
  }
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Backend server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📁 Database path: ${DB_PATH}`);
});

export default app;
