
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Use path.resolve() to consistently find the project root. 
// This resolves the 'database' directory relative to the current working directory, 
// avoiding the TypeScript error regarding the process.cwd() method availability.
const DB_PATH = path.resolve('database');

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

// Ensure directory exists
if (!fs.existsSync(DB_PATH)) {
  try {
    fs.mkdirSync(DB_PATH, { recursive: true });
  } catch (e) {
    console.error("Critical: Could not create database directory", e);
  }
}

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
  } catch (e) {
    console.error(`Error writing ${filename}:`, e);
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method === 'GET') {
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

      // Calculate admin wallet based on completed sales
      const adminWallet = sales
        .filter((s: any) => s.status === 'completed')
        .reduce((acc: number, sale: any) => {
          const product = products.find((p: any) => p.id === sale.productId);
          return acc + (product ? product.adminShare : 0);
        }, 0);

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
  }

  if (method === 'POST') {
    const { action, payload } = req.body;

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
               currentUsers[idxByEmail] = payload;
               writeFile('users', currentUsers);
            }
          }
          break;
          
        case 'APPEND_ANNOUNCEMENT':
          const currentAnns = readFile('announcements');
          writeFile('announcements', [payload, ...currentAnns]);
          break;

        case 'APPEND_WITHDRAWAL':
          const currentWithdrawals = readFile('withdrawals');
          writeFile('withdrawals', [payload, ...currentWithdrawals]);
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
  }
}
