
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Use path.resolve('database') to ensure the path is correct relative to the project root.
const DB_PATH = path.resolve('database');

// Ensure directory exists
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

const readFile = (filename: string) => {
  const filePath = path.join(DB_PATH, `${filename}.json`);
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (e) {
    return [];
  }
};

const writeFile = (filename: string, data: any) => {
  const filePath = path.join(DB_PATH, `${filename}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method === 'GET') {
    try {
      const users = readFile('users');
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
            writeFile('users', [...currentUsers, payload]);
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
      console.error("DB Write Error:", error);
      return res.status(500).json({ error: 'Failed to write to database' });
    }
  }
}
