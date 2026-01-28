
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Fix: Use path.resolve('database') instead of path.join(process.cwd(), 'database') to avoid TypeScript error where 'cwd' is not recognized on 'process' in certain environments.
const DB_PATH = path.resolve('database');

const readFile = (filename: string) => {
  const filePath = path.join(DB_PATH, `${filename}.json`);
  if (!fs.existsSync(filePath)) return [];
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
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
          // Full state overwrite (if needed)
          writeFile('users', payload.users);
          writeFile('sales', payload.sales);
          writeFile('products', payload.products);
          writeFile('announcements', payload.announcements);
          writeFile('withdrawals', payload.withdrawRequests);
          break;

        case 'APPEND_SALE':
          const currentSales = readFile('sales');
          writeFile('sales', [payload, ...currentSales]);
          break;

        case 'UPDATE_USER':
          const currentUsers = readFile('users');
          const updatedUsers = currentUsers.map((u: any) => u.id === payload.id ? payload : u);
          writeFile('users', updatedUsers);
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
          const