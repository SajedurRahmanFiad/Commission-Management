import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../services/supabaseClient.ts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const q = (req.query.q || '').toString().trim();
      if (!q) {
        const { data, error } = await supabase.from('sales').select('*').order('timestamp', { ascending: false });
        if (error) throw error;
        return res.status(200).json(data || []);
      }
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
      return res.status(500).json({ error: 'Failed to fetch sales' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
