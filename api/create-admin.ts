import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../services/supabaseClient.js';

const DEFAULT_ADMIN = {
  id: '1',
  email: 'admin@system.com',
  password: 'admin',
  role: 'admin',
  wallet: 0,
  totalSalesCount: 0,
  username: 'System Admin',
  notifications: []
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const payload = req.body || {};
  if (!payload.email || !payload.password) return res.status(400).json({ error: 'email and password required' });
  const email = (payload.email || '').toString().toLowerCase();
  const allowedKeys = ['id','email','password','username','avatar','role','wallet','total_sales_count','bkash_number','nagad_number','rocket_number'];
  const keyMap: any = { bkashNumber: 'bkash_number', nagadNumber: 'nagad_number', rocketNumber: 'rocket_number', totalSalesCount: 'total_sales_count' };
  const sanitized: any = { role: 'admin' };
  Object.keys(payload || {}).forEach((k) => {
    if (keyMap[k]) sanitized[keyMap[k]] = payload[k];
    else if (allowedKeys.includes(k)) sanitized[k] = payload[k];
  });
  sanitized.email = email;
  const { data: found, error: findErr } = await supabase.from('profiles').select('id').ilike('email', email).limit(1).maybeSingle();
  if (findErr) console.warn('Error finding existing admin by email:', findErr);
  if (found && found.id) sanitized.id = found.id;
  if (sanitized.id && typeof sanitized.id === 'string' && !/^[0-9a-fA-F\-]{36}$/.test(sanitized.id)) delete sanitized.id;
  const { data, error } = await supabase.from('profiles').upsert([sanitized], { onConflict: 'id' }).select();
  if (error) return res.status(500).json({ error: 'Failed to create admin', details: error });
  return res.status(200).json({ success: true, stored: data && data[0] });
}
