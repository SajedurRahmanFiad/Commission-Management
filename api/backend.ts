
import { NextApiRequest, NextApiResponse } from 'next';
import pool from '../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const [users] = await pool.execute('SELECT * FROM users');
      const [sales] = await pool.execute('SELECT * FROM sales ORDER BY timestamp DESC');
      const [products] = await pool.execute('SELECT * FROM products');
      const [announcements] = await pool.execute('SELECT * FROM announcements ORDER BY timestamp DESC');
      const [withdrawRequests] = await pool.execute('SELECT * FROM withdraw_requests ORDER BY timestamp DESC');
      
      // Calculate admin wallet
      const [adminWalletResult]: any = await pool.execute('SELECT SUM(adminShare) as total FROM sales WHERE status = "completed"');

      // Post-process JSON fields
      const processedUsers = (users as any[]).map(u => ({
        ...u,
        notifications: typeof u.notifications === 'string' ? JSON.parse(u.notifications) : u.notifications,
        paymentAccounts: {
          bKash: u.bkash_acc,
          Nagad: u.nagad_acc,
          Rocket: u.rocket_acc
        }
      }));

      const processedProducts = (products as any[]).map(p => ({
        ...p,
        gallery: typeof p.gallery === 'string' ? JSON.parse(p.gallery) : p.gallery
      }));

      return res.status(200).json({
        success: true,
        payload: {
          users: processedUsers,
          sales,
          products: processedProducts,
          announcements,
          withdrawRequests,
          adminWallet: adminWalletResult[0].total || 0
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { action, payload } = req.body;

    try {
      switch (action) {
        case 'CREATE_SALE':
          await pool.execute(
            'INSERT INTO sales (id, employeeId, employeeEmail, customerEmail, customerPhone, amount, productId, productName, paymentMethod, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [payload.id, payload.employeeId, payload.employeeEmail, payload.customerEmail, payload.customerPhone, payload.amount, payload.productId, payload.productName, payload.paymentMethod, payload.status, payload.timestamp]
          );
          break;

        case 'APPROVE_SALE':
          const [saleData]: any = await pool.execute('SELECT * FROM sales WHERE id = ?', [payload.saleId]);
          const sale = saleData[0];
          const [productData]: any = await pool.execute('SELECT * FROM products WHERE id = ?', [sale.productId]);
          const product = productData[0];
          const commission = sale.amount - product.adminShare;

          await pool.execute('UPDATE sales SET status = "completed", approvedAt = NOW() WHERE id = ?', [payload.saleId]);
          await pool.execute('UPDATE users SET wallet = wallet + ?, totalSalesCount = totalSalesCount + 1 WHERE id = ?', [commission, sale.employeeId]);
          break;

        case 'ADD_PRODUCT':
          await pool.execute(
            'INSERT INTO products (id, name, adminShare, description, mainImage, gallery) VALUES (?, ?, ?, ?, ?, ?)',
            [payload.id, payload.name, payload.adminShare, payload.description, payload.mainImage, JSON.stringify(payload.gallery)]
          );
          break;

        case 'UPDATE_PROFILE':
          await pool.execute(
            'UPDATE users SET username = ?, avatar = ?, bkash_acc = ?, nagad_acc = ?, rocket_acc = ? WHERE id = ?',
            [payload.username, payload.avatar, payload.paymentAccounts.bKash, payload.paymentAccounts.Nagad, payload.paymentAccounts.Rocket, payload.userId]
          );
          break;

        case 'ADD_ANNOUNCEMENT':
          await pool.execute(
            'INSERT INTO announcements (id, title, content, timestamp) VALUES (?, ?, ?, ?)',
            [payload.id, payload.title, payload.content, payload.timestamp]
          );
          break;

        case 'REQUEST_WITHDRAW':
          await pool.execute(
            'INSERT INTO withdraw_requests (id, employeeId, employeeEmail, amount, method, accountNumber, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [payload.id, payload.employeeId, payload.employeeEmail, payload.amount, payload.method, payload.accountNumber, payload.status, payload.timestamp]
          );
          await pool.execute('UPDATE users SET wallet = wallet - ? WHERE id = ?', [payload.amount, payload.employeeId]);
          break;

        case 'COMPLETE_WITHDRAW':
          await pool.execute('UPDATE withdraw_requests SET status = "completed" WHERE id = ?', [payload.id]);
          break;
          
        case 'ADD_EMPLOYEE':
          await pool.execute(
            'INSERT INTO users (id, email, password, role, wallet, totalSalesCount, notifications) VALUES (?, ?, ?, ?, 0, 0, "[]")',
            [payload.id, payload.email, payload.password, payload.role]
          );
          break;

        case 'DELETE_EMPLOYEE':
          await pool.execute('DELETE FROM users WHERE id = ?', [payload.id]);
          break;
      }
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
