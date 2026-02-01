import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../services/supabaseClient.js';

const HAS_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

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

// In-memory DB for Next API dev fallback
(global as any).__memDB = (global as any).__memDB || { users: [DEFAULT_ADMIN] };
const mem = (global as any).__memDB;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const lowerEmail = (email || '').toString().toLowerCase();

    if (!HAS_SUPABASE) {
      const user = mem.users.find((u: any) => (u.email || '').toLowerCase() === lowerEmail && u.password === password);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const { password: _pw, ...safe } = user;
      return res.status(200).json({ user: safe });
    }

    const { data, error } = await supabase.from('profiles').select('*').ilike('email', lowerEmail).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) {
      if (lowerEmail === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
        const { password: _pw, ...safe } = DEFAULT_ADMIN as any;
        return res.status(200).json({ user: safe });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (data.password && data.password === password) {
      const { password: _pw, ...safe } = data as any;
      return res.status(200).json({ user: safe });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('/api/login error (Next API)', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}
