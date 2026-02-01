// Deprecated: This file is no longer used. All API endpoints are now serverless functions. Safe to delete.


import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { supabase } from '../services/supabaseClient.ts';

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

// Multer configuration for file uploads (disk fallback) and memory upload for Supabase
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

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
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

// Serve uploaded files statically (legacy; new uploads go to Supabase Storage)
app.use('/uploads', express.static(UPLOADS_PATH));
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

// In-memory fallback DB for local development when Supabase is not configured
const HAS_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const memoryDB: any = {
  users: [DEFAULT_ADMIN],
  products: [],
  sales: [],
  announcements: [],
  withdrawRequests: [],
};

// Note: JSON file helpers removed — server now uses Supabase for persistence.

// FILE UPLOAD endpoint - handle image uploads for avatars and products
// Upload to Supabase Storage (preferred). Fallback to disk storage if memory upload fails.
app.post('/api/upload', uploadMemory.single('file'), async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || 'product';
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No file uploaded' });

    const fileExt = path.extname(req.file.originalname) || '';
    const filename = `${Date.now()}${fileExt}`;
    const key = `${type}/${filename}`;

    if (!HAS_SUPABASE) {
      // Supabase not configured - fallback to disk storage
      return upload.single('file')(req as any, res as any, (err: any) => {
        if (err) {
          console.error('Disk upload failed (no Supabase):', err);
          return res.status(500).json({ error: 'Fallback disk upload failed', details: String(err) });
        }
        const uploadType = req.query.type as string || 'product';
        const fileUrl = `/database/uploads/${uploadType === 'avatar' ? 'avatars' : 'product'}/${(req.file as any).filename}`;
        return res.status(200).json({ success: true, filePath: fileUrl, filename: (req.file as any).filename });
      });
    }

    try {
      const { data, error } = await supabase.storage.from('uploads').upload(key, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

      if (error) {
        console.error('Supabase upload error:', JSON.stringify(error));
        // fallback to disk
        return upload.single('file')(req as any, res as any, (err: any) => {
          if (err) {
            console.error('Disk fallback upload failed:', err);
            return res.status(500).json({ error: 'Fallback upload failed', details: String(err), supabaseError: error });
          }
          const uploadType = req.query.type as string || 'product';
          const fileUrl = `/database/uploads/${uploadType === 'avatar' ? 'avatars' : 'product'}/${(req.file as any).filename}`;
          return res.status(200).json({ success: true, filePath: fileUrl, filename: (req.file as any).filename, supabaseError: error });
        });
      }

      // getPublicUrl returns { data: { publicUrl: string } }
      const pub = supabase.storage.from('uploads').getPublicUrl(key);
      const publicURL = (pub as any)?.data?.publicUrl || (pub as any)?.publicURL || '';
      return res.status(200).json({ success: true, filePath: publicURL, filename });
    } catch (err: any) {
      console.error('Supabase upload exception:', err && (err.message || err.details || JSON.stringify(err)));
      // Attempt disk fallback
      return upload.single('file')(req as any, res as any, (e: any) => {
        if (e) {
          console.error('Disk fallback upload failed after exception:', e);
          return res.status(500).json({ error: 'Upload failed', details: String(err) });
        }
        const uploadType = req.query.type as string || 'product';
        const fileUrl = `/database/uploads/${uploadType === 'avatar' ? 'avatars' : 'product'}/${(req.file as any).filename}`;
        return res.status(200).json({ success: true, filePath: fileUrl, filename: (req.file as any).filename, supabaseException: String(err) });
      });
    }
  } catch (error) {
    console.error('File upload error:', error && (error.message || JSON.stringify(error)));
    return res.status(500).json({ error: 'Failed to upload file', details: error && (error.message || JSON.stringify(error)) });
  }
});

// GET endpoint - fetch all data
app.get('/api/db', async (req: Request, res: Response) => {
  try {
    const HAS_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!HAS_SUPABASE) {
      // Supabase not configured — return in-memory default admin and empty datasets
      return res.status(200).json({ users: [DEFAULT_ADMIN], sales: [], products: [], announcements: [], withdrawRequests: [], adminWallet: 0 });
    }

    // Fetch from Supabase (check per-table errors for improved diagnostics)
    let results;
    try {
      results = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('sales').select('*').order('timestamp', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('announcements').select('*'),
        supabase.from('withdraw_requests').select('*')
      ]);
    } catch (err) {
      console.error('Supabase Promise.all error in GET /api/db:', err);
      return res.status(500).json({ error: 'Supabase fetch failed', details: String(err) });
    }

    // Inspect results for per-table errors
    const perTableErrors: any[] = [];
    const usersRes = results[0] || {};
    const salesRes = results[1] || {};
    const productsRes = results[2] || {};
    const announcementsRes = results[3] || {};
    const withdrawalsRes = results[4] || {};

    if (usersRes.error) perTableErrors.push({ table: 'profiles', error: usersRes.error });
    if (salesRes.error) perTableErrors.push({ table: 'sales', error: salesRes.error });
    if (productsRes.error) perTableErrors.push({ table: 'products', error: productsRes.error });
    if (announcementsRes.error) perTableErrors.push({ table: 'announcements', error: announcementsRes.error });
    if (withdrawalsRes.error) perTableErrors.push({ table: 'withdraw_requests', error: withdrawalsRes.error });

    if (perTableErrors.length) {
      console.error('Supabase table fetch errors in GET /api/db:', JSON.stringify(perTableErrors, null, 2));
      return res.status(500).json({ error: 'Supabase table fetch errors', details: perTableErrors });
    }

    const users = usersRes.data || [];
    const sales = salesRes.data || [];
    const products = productsRes.data || [];
    const announcements = announcementsRes.data || [];
    const withdrawals = withdrawalsRes.data || [];

    let usersArr: any[] = users;
    const salesArr: any[] = sales;
    const productsArr: any[] = products;
    const announcementsArr: any[] = announcements;
    const withdrawalsArr: any[] = withdrawals;

    // Auto-seed default admin into Supabase if no profiles exist
    if (!usersArr || usersArr.length === 0) {
      try {
        await supabase.from('profiles').insert([DEFAULT_ADMIN]);
        usersArr = [DEFAULT_ADMIN];
        console.log('Seeded default admin into Supabase profiles');
      } catch (e) {
        console.error('Failed to seed default admin into Supabase:', e);
      }
    }

    // Compute adminWallet similar to previous logic
    const adminWallet = salesArr
      .filter((s: any) => s.status === 'completed')
      .reduce((acc: number, sale: any) => {
        const product = productsArr.find((p: any) => p.id === sale.product_id || p.id === sale.productId);
        if (!product) return acc;
        if ((product.pricing_model || product.pricingModel) === 'commission') {
          const percent = product.commission_percent || product.commissionPercent || 0;
          return acc + Math.round((sale.amount * percent) / 100);
        }
        return acc + (product.admin_share || product.adminShare || 0);
      }, 0);

    return res.status(200).json({
      users: usersArr,
      sales: salesArr,
      products: productsArr,
      announcements: announcementsArr,
      withdrawRequests: withdrawalsArr,
      adminWallet
    });
  } catch (error) {
    console.error('GET DB Error:', error);
    return res.status(500).json({ error: 'Failed to read database' });
  }
});

// GET products - search by query ?q=
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    const { data, error } = await supabase.from('products').select('*').or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (error) {
    console.error('GET /api/products error:', error);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET users - search by query ?q= and optional role param
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q || '').toString().trim();
    const role = (req.query.role || '').toString();
    let query = supabase.from('profiles').select('*');
    if (role) query = query.eq('role', role);
    if (!q) {
      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    const { data, error } = await supabase.from('profiles').select('*').or(`email.ilike.%${q}%,username.ilike.%${q}%`);
    if (error) throw error;
    return res.status(200).json(data || []);
  } catch (error) {
    console.error('GET /api/users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET sales - search by q (customer email/phone, product name, employee email/username)
app.get('/api/sales', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) {
      const { data, error } = await supabase.from('sales').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    }
    // For search, fetch sales and join client-side (simple approach)
    const [salesRes, productsRes, usersRes] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('products').select('*'),
      supabase.from('profiles').select('*')
    ]);

    const salesArr = salesRes?.data || [];
    const productsArr = productsRes?.data || [];
    const usersArr = usersRes?.data || [];

    const filtered = salesArr.filter((s: any) => {
      const custEmail = (s.customer_email || s.customerEmail || '').toString().toLowerCase();
      const custPhone = (s.customer_phone || s.customerPhone || '').toString().toLowerCase();
      const product = productsArr.find((p: any) => p.id === s.product_id || p.id === s.productId) || {};
      const productName = (s.product_name || s.productName || product.name || '').toString().toLowerCase();
      const emp = usersArr.find((u: any) => u.id === s.employee_id) || usersArr.find((u: any) => u.email === s.employee_email) || {};
      const empEmail = (emp?.email || '').toString().toLowerCase();
      const empName = (emp?.username || '').toString().toLowerCase();
      return custEmail.includes(q) || custPhone.includes(q) || productName.includes(q) || empEmail.includes(q) || empName.includes(q);
    });

    return res.status(200).json(filtered);
  } catch (error) {
    console.error('GET /api/sales error:', error);
    return res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET withdrawals - search by q (account number, agent email/username, status, amount)
app.get('/api/withdrawals', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) {
      const { data, error } = await supabase.from('withdraw_requests').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    const [withdrawalsRes, usersRes] = await Promise.all([
      supabase.from('withdraw_requests').select('*'),
      supabase.from('profiles').select('*')
    ]);

    const withdrawalsArr = withdrawalsRes?.data || [];
    const usersArr = usersRes?.data || [];

    const filtered = withdrawalsArr.filter((w: any) => {
      const acc = (w.account_number || w.accountNumber || '').toString().toLowerCase();
      const status = (w.status || '').toString().toLowerCase();
      const amount = (w.amount || '').toString().toLowerCase();
      const emp = usersArr.find((u: any) => u.id === w.employee_id) || usersArr.find((u: any) => u.email === w.employee_email) || {};
      const empEmail = (emp.email || '').toString().toLowerCase();
      const empName = (emp.username || '').toString().toLowerCase();
      return acc.includes(q) || status.includes(q) || amount.includes(q) || empEmail.includes(q) || empName.includes(q);
    });

    return res.status(200).json(filtered);
  } catch (error) {
    console.error('GET /api/withdrawals error:', error);
    return res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// POST endpoint - write/append data
app.post('/api/db', async (req: Request, res: Response) => {
  const { action, payload } = req.body;
  console.log(`Received POST request - Action: ${action}`);

  try {
    // If Supabase is not configured, operate on in-memory DB (dev only)
    if (!HAS_SUPABASE) {
      switch (action) {
        case 'SYNC_STATE':
          if (payload.users) memoryDB.users = payload.users;
          if (payload.sales) memoryDB.sales = payload.sales;
          if (payload.products) memoryDB.products = payload.products;
          if (payload.announcements) memoryDB.announcements = payload.announcements;
          if (payload.withdrawRequests) memoryDB.withdrawRequests = payload.withdrawRequests;
          break;

        case 'APPEND_SALE':
          memoryDB.sales.unshift(payload);
          break;

        case 'UPDATE_USER': {
          const idx = memoryDB.users.findIndex((u: any) => u.id === payload.id || (u.email || '').toLowerCase() === (payload.email || '').toLowerCase());
          if (idx > -1) memoryDB.users[idx] = { ...memoryDB.users[idx], ...payload };
          else memoryDB.users.push(payload);
          break;
        }

        case 'APPEND_ANNOUNCEMENT':
          memoryDB.announcements.unshift(payload);
          break;

        case 'UPDATE_ANNOUNCEMENT':
          memoryDB.announcements = memoryDB.announcements.map((a: any) => a.id === payload.id ? payload : a);
          break;

        case 'DELETE_ANNOUNCEMENT':
          memoryDB.announcements = memoryDB.announcements.filter((a: any) => a.id !== payload.id);
          break;

        case 'APPEND_WITHDRAWAL':
          memoryDB.withdrawRequests.unshift(payload);
          break;

        case 'UPDATE_WITHDRAWAL':
          memoryDB.withdrawRequests = memoryDB.withdrawRequests.map((w: any) => w.id === payload.id ? payload : w);
          break;

        case 'UPDATE_SALE':
          memoryDB.sales = memoryDB.sales.map((s: any) => s.id === payload.id ? payload : s);
          break;

        case 'UPDATE_PRODUCT':
          if (Array.isArray(payload)) memoryDB.products = payload;
          else if (payload.id) {
            const idxp = memoryDB.products.findIndex((p: any) => p.id === payload.id);
            if (idxp > -1) memoryDB.products[idxp] = { ...memoryDB.products[idxp], ...payload };
            else memoryDB.products.push(payload);
          }
          break;

        default:
          return res.status(400).json({ error: 'Unknown action' });
      }

      return res.status(200).json({ success: true, memoryDB });
    }

    // Supabase mode
    switch (action) {
      case 'SYNC_STATE':
        // Replace entire tables (useful for initialization). Use upsert/replace logic per table.
        if (payload.users) {
          await supabase.from('profiles').upsert(payload.users, { onConflict: 'id' });
        }
        if (payload.sales) {
          await supabase.from('sales').upsert(payload.sales, { onConflict: 'id' });
        }
        if (payload.products) {
          await supabase.from('products').upsert(payload.products, { onConflict: 'id' });
        }
        if (payload.announcements) {
          await supabase.from('announcements').upsert(payload.announcements, { onConflict: 'id' });
        }
        if (payload.withdrawRequests) {
          await supabase.from('withdraw_requests').upsert(payload.withdrawRequests, { onConflict: 'id' });
        }
        break;

      case 'APPEND_SALE': {
        // Sanitize incoming sale payload to match DB columns (snake_case)
        const sanitizeSale = (s: any) => {
          const keyMap: any = {
            id: 'id',
            employeeId: 'employee_id',
            employeeEmail: 'employee_email',
            customerEmail: 'customer_email',
            customerPhone: 'customer_phone',
            productId: 'product_id',
            productName: 'product_name',
            amount: 'amount',
            status: 'status',
            timestamp: 'timestamp',
            paymentMethod: 'payment_method'
          };
          const allowed = ['id','employee_id','employee_email','customer_email','customer_phone','product_id','product_name','amount','status','timestamp','payment_method'];
          const out: any = {};
          Object.keys(s || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = s[k];
          });
          // Ensure numeric types
          if (out.amount !== undefined) out.amount = Number(out.amount);
          return out;
        };

        try {
          const sanitized = sanitizeSale(payload);

          // Helper to detect UUIDs
          const isUUID = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);

          // If sale id is present but not a UUID, remove it to let DB generate a proper id
          if (sanitized.id && !isUUID(sanitized.id)) {
            console.warn('Dropping non-UUID sale id before insert (was temp id):', sanitized.id);
            delete sanitized.id;
          }

          // If employee_id is present but not a UUID, try to map via employee_email. Otherwise drop it to avoid UUID cast errors.
          if (sanitized.employee_id && !isUUID(sanitized.employee_id)) {
            if (sanitized.employee_email) {
              try {
                const { data: found, error: findErr } = await supabase.from('profiles').select('id').ilike('email', sanitized.employee_email).limit(1).maybeSingle();
                if (findErr) {
                  console.warn('Error finding profile by email while inserting sale:', findErr);
                }
                if (found && found.id && isUUID(found.id)) {
                  sanitized.employee_id = found.id;
                } else {
                  console.warn('Dropping non-UUID employee_id from sale insert; fallback to employee_email', sanitized.employee_id);
                  delete sanitized.employee_id;
                }
              } catch (e) {
                console.warn('Exception while looking up profile for sale insert:', e);
                delete sanitized.employee_id;
              }
            } else {
              console.warn('Dropping non-UUID employee_id from sale insert (no employee_email available):', sanitized.employee_id);
              delete sanitized.employee_id;
            }
          }

          // If product_id exists and is not a UUID but DB expects UUID, we could similarly try to look up by name; skip for now unless we see errors.

          const { data, error } = await supabase.from('sales').insert([sanitized]).select();
          if (error) {
            console.error('Supabase insert sale error:', error);
            return res.status(500).json({ error: 'Failed to append sale', details: error });
          }
          return res.status(200).json({ success: true, stored: data && data[0] });
        } catch (err: any) {
          console.error('APPEND_SALE handler error:', err);
          return res.status(500).json({ error: 'Failed to append sale', details: String(err) });
        }
      }

      

      case 'UPDATE_USER':
        // If payload has id, update; otherwise insert
        console.log('UPDATE_USER payload:', {
          id: payload?.id,
          email: payload?.email,
          role: payload?.role,
          wallet: payload?.wallet,
          totalSalesCount: payload?.totalSalesCount,
          username: payload?.username,
          avatar: payload?.avatar,
          password: payload?.password ? '***' : undefined,
        });
        try {
          // Whitelist known profile columns to avoid Supabase errors for unknown columns
          const allowedKeys = ['id','email','password','role','wallet','username','avatar','total_sales_count','bkash_number','nagad_number','rocket_number'];
          const keyMap: any = { totalSalesCount: 'total_sales_count', total_sales_count: 'total_sales_count', bkashNumber: 'bkash_number', nagadNumber: 'nagad_number', rocketNumber: 'rocket_number' };
          const sanitized: any = {};

          Object.keys(payload || {}).forEach((k) => {
            if (keyMap[k]) sanitized[keyMap[k]] = payload[k];
            else if (allowedKeys.includes(k)) sanitized[k] = payload[k];
          });

          // Normalize email to lowercase if present
          if (payload?.email && !sanitized.email) sanitized.email = payload.email.toString().toLowerCase();

          // Log dropped keys for visibility
          const dropped = Object.keys(payload || {}).filter(k => !(allowedKeys.includes(k) || Object.keys(keyMap).includes(k)));
          if (dropped.length) console.warn('UPDATE_USER dropping unknown profile fields:', dropped);

          // Try upsert, and if Supabase reports missing columns, drop them and retry
          const isUUID = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);

          const tryUpsert = async (obj: any) => {
            try {
              // If id is present but not a valid UUID, remove it to let the DB generate one
              let idWasTemp: string | null = null;
              if (obj.id && !isUUID(obj.id)) {
                idWasTemp = obj.id;
                delete obj.id;
                console.warn('Dropping non-UUID id before upsert (was temp id):', idWasTemp);
              }

              const { data, error } = await supabase.from('profiles').upsert([obj], { onConflict: 'id' }).select();
              if (error) throw error;

              const returnedId = (data && data[0] && data[0].id) ? data[0].id : null;
              const stored = (data && data[0]) || null;
              return { success: true, dropped: [], id: returnedId, idWasTemp, stored };
            } catch (err: any) {
              const msg = (err && (err.message || err.error_description || err.details || JSON.stringify(err))) || String(err);
              // Detect missing column errors
              const missingCols: string[] = [];
              const regex = /Could not find the '([^']+)' column/gi;
              let m: RegExpExecArray | null;
              while ((m = regex.exec(msg)) !== null) {
                missingCols.push(m[1]);
              }

              if (missingCols.length) {
                missingCols.forEach(c => delete obj[c]);
                console.warn('Upsert retry dropping missing columns:', missingCols);
                // Retry once without those columns
                const { data: data2, error: err2 } = await supabase.from('profiles').upsert([obj], { onConflict: 'id' }).select();
                if (err2) {
                  console.error('Supabase upsert retry error:', err2);
                  throw err2;
                }
                const returnedId = (data2 && data2[0] && data2[0].id) ? data2[0].id : null;
                const stored = (data2 && data2[0]) || null;
                return { success: true, dropped: missingCols, id: returnedId, stored };
              }

              throw err;
            }
          };

          if (sanitized.id && isUUID(sanitized.id)) {
            const resUp = await tryUpsert(sanitized);
            if (resUp.dropped && resUp.dropped.length) return res.status(200).json({ success: true, droppedColumns: resUp.dropped, id: resUp.id, stored: resUp.stored });
            if (resUp.id) return res.status(200).json({ success: true, id: resUp.id, stored: resUp.stored });
          } else if (sanitized.email) {
            // If sanitized.id is present but not a UUID, we'll remove it and let DB generate a new id
            const hadTempId = !!(sanitized.id && !isUUID(sanitized.id));
            if (hadTempId) delete sanitized.id;

            const { data: findData, error: findError } = await supabase.from('profiles').select('id').eq('email', sanitized.email).limit(1).maybeSingle();
            if (findError) {
              console.error('Supabase select error (find by email):', findError);
              return res.status(500).json({ error: findError.message || findError });
            }
            if (findData?.id) sanitized.id = findData.id;

            const resUp = await tryUpsert(sanitized);
            if (resUp.dropped && resUp.dropped.length) return res.status(200).json({ success: true, droppedColumns: resUp.dropped, id: resUp.id, stored: resUp.stored });
            if (resUp.id) {
              // If we had a temp id, return mapping so frontend can replace it
              return res.status(200).json({ success: true, id: resUp.id, idWasTemp: resUp.idWasTemp, stored: resUp.stored });
            }
          }
        } catch (e) {
          console.error('UPDATE_USER handler error:', e);
          return res.status(500).json({ error: e.message || e });
        }
        break; 

      case 'APPEND_ANNOUNCEMENT': {
        // Sanitize announcement payload to match DB schema
        const sanitizeAnnouncement = (a: any) => {
          const keyMap: any = { seenBy: 'seen_by' };
          const allowed = ['id','title','content','timestamp','seen_by'];
          const out: any = {};
          Object.keys(a || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = a[k];
          });
          return out;
        };

        try {
          const sanitized = sanitizeAnnouncement(payload);
          // Drop non-UUID id (temp client ids) so DB will generate proper UUID
          const isUUID = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
          if (sanitized.id && !isUUID(sanitized.id)) delete sanitized.id;

          const { data, error } = await supabase.from('announcements').insert([sanitized]).select();
          if (error) {
            console.error('Supabase insert announcement error:', error);
            return res.status(500).json({ error: 'Failed to append announcement', details: error });
          }
          return res.status(200).json({ success: true, stored: data && data[0] });
        } catch (err: any) {
          console.error('APPEND_ANNOUNCEMENT handler error:', err);
          return res.status(500).json({ error: 'Failed to append announcement', details: String(err) });
        }
      }

      case 'UPDATE_ANNOUNCEMENT': {
        // Sanitize update payload
        const sanitizeAnnouncementUpdate = (a: any) => {
          const keyMap: any = { seenBy: 'seen_by' };
          const allowed = ['title','content','timestamp','seen_by'];
          const out: any = {};
          Object.keys(a || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = a[k];
          });
          return out;
        };
        try {
          const id = payload?.id;
          if (!id) {
            console.warn('UPDATE_ANNOUNCEMENT called without id');
            break;
          }
          const sanitized = sanitizeAnnouncementUpdate(payload);
          const { data, error } = await supabase.from('announcements').update(sanitized).eq('id', id).select();
          if (error) {
            console.error('Supabase update announcement error:', error);
            return res.status(500).json({ error: 'Failed to update announcement', details: error });
          }
          return res.status(200).json({ success: true, stored: data && data[0] });
        } catch (e) {
          console.error('UPDATE_ANNOUNCEMENT handler error:', e);
          return res.status(500).json({ error: 'Failed to update announcement', details: String(e) });
        }
      }

      case 'DELETE_ANNOUNCEMENT':
        await supabase.from('announcements').delete().eq('id', payload.id);
        break;

      case 'APPEND_WITHDRAWAL': {
        try {
          // Sanitize incoming withdrawal payload to match DB columns
          const sanitizeW = (w: any) => {
            const keyMap: any = { employeeId: 'employee_id', employeeEmail: 'employee_email', accountNumber: 'account_number' };
            const allowed = ['id','employee_id','employee_email','amount','method','account_number','status','timestamp'];
            const out: any = {};
            Object.keys(w || {}).forEach(k => {
              const mapped = keyMap[k] || k;
              if (allowed.includes(mapped)) out[mapped] = w[k];
            });
            if (out.amount !== undefined) out.amount = Number(out.amount);
            return out;
          };

          const isUUID = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);

          let sanitized = sanitizeW(payload);

          // Drop non-UUID id (frontend uses short temp ids) to let DB generate proper UUIDs
          if (sanitized.id && !isUUID(sanitized.id)) {
            console.warn('Dropping non-UUID withdraw id before insert (was temp id):', sanitized.id);
            delete sanitized.id;
          }

          // If employee_id is not a UUID, try to map via employee_email; otherwise drop it to avoid UUID cast errors
          if (sanitized.employee_id && !isUUID(sanitized.employee_id)) {
            if (sanitized.employee_email) {
              try {
                const { data: found, error: findErr } = await supabase.from('profiles').select('id').ilike('email', sanitized.employee_email).limit(1).maybeSingle();
                if (findErr) {
                  console.warn('Error finding profile by email while inserting withdrawal:', findErr);
                }
                if (found && found.id && isUUID(found.id)) {
                  sanitized.employee_id = found.id;
                } else {
                  console.warn('Dropping non-UUID employee_id from withdrawal insert; fallback to employee_email', sanitized.employee_id);
                  delete sanitized.employee_id;
                }
              } catch (e) {
                console.warn('Exception while looking up profile for withdrawal insert:', e);
                delete sanitized.employee_id;
              }
            } else {
              console.warn('Dropping non-UUID employee_id from withdrawal insert (no employee_email available):', sanitized.employee_id);
              delete sanitized.employee_id;
            }
          }

          let { data, error } = await supabase.from('withdraw_requests').insert([sanitized]).select();
          if (error) {
            console.error('Supabase insert withdrawal error:', error);
            // If the error is a duplicate key on id, try again without id so DB generates one
            const msg = (error && (error.message || error.details || JSON.stringify(error))) || String(error);
            if (/duplicate key|already exists|unique constraint/i.test(msg) || (error.code && String(error.code) === '23505')) {
              console.warn('Duplicate withdraw id detected; retrying insert without id');
              delete sanitized.id;
              const retry = await supabase.from('withdraw_requests').insert([sanitized]).select();
              if (retry.error) {
                console.error('Supabase insert withdrawal retry failed:', retry.error);
                return res.status(500).json({ error: 'Failed to append withdrawal', details: retry.error });
              }
              return res.status(200).json({ success: true, stored: retry.data && retry.data[0] });
            }
            return res.status(500).json({ error: 'Failed to append withdrawal', details: error });
          }
          return res.status(200).json({ success: true, stored: data && data[0] });
        } catch (err: any) {
          console.error('APPEND_WITHDRAWAL handler error:', err);
          return res.status(500).json({ error: 'Failed to append withdrawal', details: String(err) });
        }
      }

      case 'UPDATE_WITHDRAWAL': {
        try {
          if (!payload || !payload.id) return res.status(400).json({ error: 'id is required for UPDATE_WITHDRAWAL' });
          // Sanitize keys to match DB columns (snake_case)
          const keyMap: any = {
            employeeId: 'employee_id',
            employeeEmail: 'employee_email',
            accountNumber: 'account_number'
          };
          const allowed = ['employee_id','employee_email','amount','method','account_number','status','timestamp'];
          const updateObj: any = {};
          Object.keys(payload || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) updateObj[mapped] = payload[k];
          });
          if (updateObj.amount !== undefined) updateObj.amount = Number(updateObj.amount);

          const { data, error } = await supabase.from('withdraw_requests').update(updateObj).eq('id', payload.id).select();
          if (error) {
            console.error('Supabase update withdrawal error:', error);
            return res.status(500).json({ error: 'Failed to update withdrawal', details: error });
          }

          return res.status(200).json({ success: true, stored: data && data[0] });
        } catch (err: any) {
          console.error('UPDATE_WITHDRAWAL handler error:', err);
          return res.status(500).json({ error: 'Failed to update withdrawal', details: String(err) });
        }
      }

      case 'UPDATE_SALE': {
        // Sanitize update payload to match DB columns
        const sanitizeSaleUpdate = (s: any) => {
          const keyMap: any = {
            employeeId: 'employee_id',
            employeeEmail: 'employee_email',
            customerEmail: 'customer_email',
            customerPhone: 'customer_phone',
            productId: 'product_id',
            productName: 'product_name',
            amount: 'amount',
            status: 'status',
            timestamp: 'timestamp',
            paymentMethod: 'payment_method'
          };
          const allowed = ['employee_id','employee_email','customer_email','customer_phone','product_id','product_name','amount','status','timestamp','payment_method'];
          const out: any = {};
          Object.keys(s || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = s[k];
          });
          if (out.amount !== undefined) out.amount = Number(out.amount);
          return out;
        };

        try {
          if (!payload || !payload.id) return res.status(400).json({ error: 'id is required for UPDATE_SALE' });
          const id = payload.id;
          const updateObj = sanitizeSaleUpdate(payload);
          const { data, error } = await supabase.from('sales').update(updateObj).eq('id', id).select();
          if (error) {
            console.error('Supabase update sale error:', error);
            return res.status(500).json({ error: 'Failed to update sale', details: error });
          }
          return res.status(200).json({ success: true, stored: data && data[0] });
        } catch (err: any) {
          console.error('UPDATE_SALE handler error:', err);
          return res.status(500).json({ error: 'Failed to update sale', details: String(err) });
        }
      }

      

      case 'UPDATE_PRODUCT':
        // Sanitize incoming product payload(s) to match DB column names (snake_case) and drop unknown fields
        const sanitizeProduct = (p: any) => {
          const keyMap: any = {
            id: 'id',
            name: 'name',
            description: 'description',
            pricingModel: 'pricing_model',
            pricing_model: 'pricing_model',
            adminShare: 'admin_share',
            admin_share: 'admin_share',
            commissionPercent: 'commission_percent',
            commission_percent: 'commission_percent',
            gallery: 'gallery',
            mainImage: 'main_image',
            main_image: 'main_image'
          };
          const allowed = ['id','name','description','pricing_model','admin_share','commission_percent','gallery','main_image'];
          const out: any = {};
          Object.keys(p || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = p[k];
          });
          return out;
        };

        if (Array.isArray(payload)) {
          const sanitized = payload.map(sanitizeProduct);
          await supabase.from('products').upsert(sanitized, { onConflict: 'id' });
        } else if (payload && payload.id) {
          const sanitized = sanitizeProduct(payload);
          await supabase.from('products').upsert([sanitized], { onConflict: 'id' });
        }
        break; 

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('POST DB Write Error:', error);
    return res.status(500).json({ error: 'Failed to write to database' });
  }
});

// Authentication endpoint (email/password)
app.post('/api/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const lowerEmail = (email || '').toString().toLowerCase();

    if (!HAS_SUPABASE) {
      // Check in-memory DB
      const user = memoryDB.users.find((u: any) => (u.email || '').toLowerCase() === lowerEmail && u.password === password);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const { password: _pw, ...safe } = user;
      return res.status(200).json({ user: safe });
    }

    // Supabase flow
    const { data, error } = await supabase.from('profiles').select('*').ilike('email', lowerEmail).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) {
      // If Supabase has no profiles, allow fallback admin login
      if (lowerEmail === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
        const { password: _pw, ...safe } = DEFAULT_ADMIN as any;
        return res.status(200).json({ user: safe });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If profile has a password field and it matches, authenticate
    if (data.password && data.password === password) {
      const { password: _pw, ...safe } = data as any;
      return res.status(200).json({ user: safe });
    }

    // No stored password or mismatch
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('/api/login error', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});
// Create or upsert an admin profile into Supabase (or memory fallback)
app.post('/api/create-admin', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    if (!payload.email || !payload.password) return res.status(400).json({ error: 'email and password required' });

    const email = (payload.email || '').toString().toLowerCase();

    // Whitelist and key mapping
    const allowedKeys = ['id','email','password','username','avatar','role','wallet','total_sales_count','bkash_number','nagad_number','rocket_number'];
    const keyMap: any = { bkashNumber: 'bkash_number', nagadNumber: 'nagad_number', rocketNumber: 'rocket_number', totalSalesCount: 'total_sales_count' };
    const sanitized: any = { role: 'admin' };

    Object.keys(payload || {}).forEach((k) => {
      if (keyMap[k]) sanitized[keyMap[k]] = payload[k];
      else if (allowedKeys.includes(k)) sanitized[k] = payload[k];
    });

    sanitized.email = email; // ensure lowercase

    if (!HAS_SUPABASE) {
      // Memory fallback
      const existing = memoryDB.users.find((u: any) => (u.email || '').toLowerCase() === email);
      if (existing) {
        Object.assign(existing, sanitized);
        return res.status(200).json({ success: true, stored: existing });
      }
      const newid = sanitized.id || Math.random().toString(36).substr(2, 9);
      const newUser = { id: newid, ...sanitized };
      memoryDB.users.push(newUser);
      return res.status(200).json({ success: true, stored: newUser });
    }

    // Supabase path: try to find by email and upsert
    const { data: found, error: findErr } = await supabase.from('profiles').select('id').ilike('email', email).limit(1).maybeSingle();
    if (findErr) console.warn('Error finding existing admin by email:', findErr);
    if (found && found.id) sanitized.id = found.id;

    // Drop non-UUID id to let DB generate one
    const isUUID = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
    if (sanitized.id && !isUUID(sanitized.id)) delete sanitized.id;

    const { data, error } = await supabase.from('profiles').upsert([sanitized], { onConflict: 'id' }).select();
    if (error) {
      // Try retry drop missing columns similar to UPDATE_USER
      const msg = (error && (error.message || error.details || JSON.stringify(error))) || String(error);
      const missingCols: string[] = [];
      const regex = /Could not find the '([^']+)' column/gi;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(msg)) !== null) missingCols.push(m[1]);
      if (missingCols.length) {
        missingCols.forEach(c => delete sanitized[c]);
        const { data: data2, error: err2 } = await supabase.from('profiles').upsert([sanitized], { onConflict: 'id' }).select();
        if (err2) {
          console.error('Supabase create-admin upsert retry error:', err2);
          return res.status(500).json({ error: 'Failed to create admin', details: err2 });
        }
        return res.status(200).json({ success: true, stored: data2 && data2[0] });
      }

      console.error('Supabase create-admin upsert error:', error);
      return res.status(500).json({ error: 'Failed to create admin', details: error });
    }

    return res.status(200).json({ success: true, stored: data && data[0] });
  } catch (err: any) {
    console.error('/api/create-admin error', err);
    return res.status(500).json({ error: 'Failed to create admin', details: String(err) });
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

// On startup, if Supabase is configured, ensure the default admin exists and migrate any in-memory users into Supabase
(async function startupSeedAndMigrate() {
  if (!HAS_SUPABASE) {
    console.log('Supabase not configured; skipping startup seed/migration.');
    return;
  }

  console.log('Supabase is configured — performing startup seed/migration...');

  const parseMissingCols = (err: any) => {
    const msg = (err && (err.message || err.details || JSON.stringify(err))) || String(err);
    const missing: string[] = [];
    const regex = /Could not find the '([^']+)' column/gi;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(msg)) !== null) missing.push(m[1]);
    return missing;
  };

  const tryUpsertProfile = async (obj: any) => {
    try {
      const { data, error } = await supabase.from('profiles').upsert([obj], { onConflict: 'id' }).select();
      if (error) throw error;
      return data && data[0];
    } catch (err: any) {
      const missing = parseMissingCols(err);
      if (missing.length) {
        missing.forEach(c => delete obj[c]);
        const { data: data2, error: err2 } = await supabase.from('profiles').upsert([obj], { onConflict: 'id' }).select();
        if (err2) throw err2;
        return data2 && data2[0];
      }
      throw err;
    }
  };

  try {
    // Ensure default admin exists
    try {
      const { data: found, error: findErr } = await supabase.from('profiles').select('*').ilike('email', DEFAULT_ADMIN.email).limit(1).maybeSingle();
      if (findErr) {
        console.warn('Error checking for existing admin at startup:', findErr);
      }
      if (found && found.id) {
        console.log('Admin already exists in Supabase:', found.email);
      } else {
        const stored = await tryUpsertProfile({ ...DEFAULT_ADMIN });
        console.log('Seeded default admin into Supabase at startup:', stored?.email || DEFAULT_ADMIN.email);
      }
    } catch (e) {
      console.error('Failed to seed default admin at startup:', e);
    }

    // Migrate any other in-memory users (if present)
    const otherUsers = (memoryDB.users || []).filter((u: any) => (u.email || '').toLowerCase() !== DEFAULT_ADMIN.email);
    if (otherUsers.length) {
      console.log(`Migrating ${otherUsers.length} in-memory user(s) into Supabase...`);
      for (const u of otherUsers) {
        try {
          const sanitized = { ...u };
          // Map payout fields if present
          if (sanitized.bkashNumber) sanitized.bkash_number = sanitized.bkashNumber;
          if (sanitized.nagadNumber) sanitized.nagad_number = sanitized.nagadNumber;
          if (sanitized.rocketNumber) sanitized.rocket_number = sanitized.rocketNumber;
          delete sanitized.bkashNumber; delete sanitized.nagadNumber; delete sanitized.rocketNumber;
          const stored = await tryUpsertProfile(sanitized);
          console.log('Migrated user:', stored?.email || sanitized.email || sanitized.id);
        } catch (e) {
          console.error('Failed migrating user', u?.email || u?.id, e);
        }
      }
    }

    console.log('Startup seed/migration complete.');
  } catch (err) {
    console.error('Startup seed/migration error:', err);
  }
})();

export default app;
