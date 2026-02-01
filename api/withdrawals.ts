import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../services/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
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
      return res.status(500).json({ error: 'Failed to fetch withdrawals' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
