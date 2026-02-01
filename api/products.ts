import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../services/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
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
        return res.status(500).json({ error: 'Failed to fetch products' });
      }
    } else {
      res.setHeader('Allow', ['GET']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
