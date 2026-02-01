

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

function isUUID(s: any) {
  return typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method === 'GET') {
    try {
      const results = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('sales').select('*'),
        supabase.from('products').select('*'),
        supabase.from('announcements').select('*'),
        supabase.from('withdraw_requests').select('*')
      ]);

      let users = results[0].data || [];
      const sales = results[1].data || [];
      const products = results[2].data || [];
      const announcements = results[3].data || [];
      const withdrawals = results[4].data || [];

      // Calculate admin wallet
      const adminWallet = (sales || [])
        .filter((s: any) => s.status === 'completed')
        .reduce((acc: number, sale: any) => {
          const product = (products || []).find((p: any) => p.id === sale.product_id || p.id === sale.productId);
          if (!product) return acc;
          if ((product.pricing_model || product.pricingModel) === 'commission') {
            const percent = product.commission_percent || product.commissionPercent || 0;
            return acc + Math.round((sale.amount * percent) / 100);
          }
          return acc + (product.admin_share || product.adminShare || 0);
        }, 0);

      // Normalize withdrawal fields for frontend (employeeId, employeeEmail)
      const normalizedWithdrawals = (withdrawals || []).map((w: any) => ({
        ...w,
        employeeId: w.employee_id || w.employeeId || '',
        employeeEmail: w.employee_email || w.employeeEmail || '',
      }));

      return res.status(200).json({
        users,
        sales,
        products,
        announcements,
        withdrawRequests: normalizedWithdrawals,
        adminWallet
      });
    } catch (error) {
      console.error('GET DB Error (Next API):', error);
      return res.status(500).json({ error: 'Failed to read database' });
    }
  }

  if (method === 'POST') {
    const { action, payload } = req.body;
    try {
      switch (action) {
        case 'SYNC_STATE':
          if (payload && payload.users) await supabase.from('profiles').upsert(payload.users, { onConflict: 'id' });
          if (payload && payload.sales) await supabase.from('sales').upsert(payload.sales, { onConflict: 'id' });
          if (payload && payload.products) await supabase.from('products').upsert(payload.products, { onConflict: 'id' });
          if (payload && payload.announcements) await supabase.from('announcements').upsert(payload.announcements, { onConflict: 'id' });
          if (payload && payload.withdrawRequests) await supabase.from('withdraw_requests').upsert(payload.withdrawRequests, { onConflict: 'id' });
          break;
        case 'APPEND_SALE': {
          // Sanitize sale
          const keyMap: any = {
            id: 'id', employeeId: 'employee_id', employeeEmail: 'employee_email', customerEmail: 'customer_email', customerPhone: 'customer_phone', productId: 'product_id', productName: 'product_name', amount: 'amount', status: 'status', timestamp: 'timestamp', paymentMethod: 'payment_method'
          };
          const allowed = ['id','employee_id','employee_email','customer_email','customer_phone','product_id','product_name','amount','status','timestamp','payment_method'];
          const out: any = {};
          Object.keys(payload || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = payload[k];
          });
          if (out.amount !== undefined) out.amount = Number(out.amount);
          if (out.id && !isUUID(out.id)) delete out.id;
          if (out.employee_id && !isUUID(out.employee_id)) {
            if (out.employee_email) {
              const { data: found } = await supabase.from('profiles').select('id').ilike('email', out.employee_email).limit(1).maybeSingle();
              if (found && found.id && isUUID(found.id)) out.employee_id = found.id;
              else delete out.employee_id;
            } else {
              delete out.employee_id;
            }
          }
          const { data, error } = await supabase.from('sales').insert([out]).select();
          if (error) return res.status(500).json({ error: 'Failed to append sale', details: error });
          return res.status(200).json({ success: true, stored: data && data[0] });
        }
        case 'UPDATE_USER': {
          // Whitelist known profile columns
          const allowedKeys = ['id','email','password','role','wallet','username','avatar','total_sales_count','bkash_number','nagad_number','rocket_number'];
          const keyMap: any = { totalSalesCount: 'total_sales_count', total_sales_count: 'total_sales_count', bkashNumber: 'bkash_number', nagadNumber: 'nagad_number', rocketNumber: 'rocket_number' };
          const sanitized: any = {};
          Object.keys(payload || {}).forEach((k) => {
            if (keyMap[k]) sanitized[keyMap[k]] = payload[k];
            else if (allowedKeys.includes(k)) sanitized[k] = payload[k];
          });
          if (payload?.email && !sanitized.email) sanitized.email = payload.email.toString().toLowerCase();
          if (sanitized.id && !isUUID(sanitized.id)) delete sanitized.id;
          const { data, error } = await supabase.from('profiles').upsert([sanitized], { onConflict: 'id' }).select();
          if (error) return res.status(500).json({ error: 'Failed to update user', details: error });
          return res.status(200).json({ success: true, stored: data && data[0] });
        }
        case 'APPEND_ANNOUNCEMENT': {
          const keyMap: any = { seenBy: 'seen_by' };
          const allowed = ['id','title','content','timestamp','seen_by'];
          const out: any = {};
          Object.keys(payload || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = payload[k];
          });
          if (out.id && !isUUID(out.id)) delete out.id;
          const { data, error } = await supabase.from('announcements').insert([out]).select();
          if (error) return res.status(500).json({ error: 'Failed to append announcement', details: error });
          return res.status(200).json({ success: true, stored: data && data[0] });
        }
        case 'UPDATE_ANNOUNCEMENT': {
          const keyMap: any = { seenBy: 'seen_by' };
          const allowed = ['title','content','timestamp','seen_by'];
          const out: any = {};
          Object.keys(payload || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = payload[k];
          });
          if (!payload?.id) return res.status(400).json({ error: 'id is required for UPDATE_ANNOUNCEMENT' });
          const { data, error } = await supabase.from('announcements').update(out).eq('id', payload.id).select();
          if (error) return res.status(500).json({ error: 'Failed to update announcement', details: error });
          return res.status(200).json({ success: true, stored: data && data[0] });
        }
        case 'DELETE_ANNOUNCEMENT':
          if (payload) await supabase.from('announcements').delete().eq('id', payload.id);
          break;
        case 'APPEND_WITHDRAWAL': {
          const keyMap: any = { employeeId: 'employee_id', employeeEmail: 'employee_email', accountNumber: 'account_number' };
          const allowed = ['id','employee_id','employee_email','amount','method','account_number','status','timestamp'];
          const out: any = {};
          Object.keys(payload || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = payload[k];
          });
          if (out.amount !== undefined) out.amount = Number(out.amount);
          if (out.id && !isUUID(out.id)) delete out.id;
          if (out.employee_id && !isUUID(out.employee_id)) {
            if (out.employee_email) {
              const { data: found } = await supabase.from('profiles').select('id').ilike('email', out.employee_email).limit(1).maybeSingle();
              if (found && found.id && isUUID(found.id)) out.employee_id = found.id;
              else delete out.employee_id;
            } else {
              delete out.employee_id;
            }
          }
          const { data, error } = await supabase.from('withdraw_requests').insert([out]).select();
          if (error) {
            const msg = (error && (error.message || error.details || JSON.stringify(error))) || String(error);
            if (/duplicate key|already exists|unique constraint/i.test(msg) || (error.code && String(error.code) === '23505')) {
              delete out.id;
              const retry = await supabase.from('withdraw_requests').insert([out]).select();
              if (retry.error) return res.status(500).json({ error: 'Failed to append withdrawal', details: retry.error });
              return res.status(200).json({ success: true, stored: retry.data && retry.data[0] });
            }
            return res.status(500).json({ error: 'Failed to append withdrawal', details: error });
          }
          return res.status(200).json({ success: true, stored: data && data[0] });
        }
        case 'UPDATE_WITHDRAWAL': {
          if (!payload || !payload.id) return res.status(400).json({ error: 'id is required for UPDATE_WITHDRAWAL' });
          const keyMap: any = { employeeId: 'employee_id', employeeEmail: 'employee_email', accountNumber: 'account_number' };
          const allowed = ['employee_id','employee_email','amount','method','account_number','status','timestamp'];
          const out: any = {};
          Object.keys(payload || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = payload[k];
          });
          if (out.amount !== undefined) out.amount = Number(out.amount);
          const { data, error } = await supabase.from('withdraw_requests').update(out).eq('id', payload.id).select();
          if (error) return res.status(500).json({ error: 'Failed to update withdrawal', details: error });
          return res.status(200).json({ success: true, stored: data && data[0] });
        }
        case 'UPDATE_SALE': {
          if (!payload || !payload.id) return res.status(400).json({ error: 'id is required for UPDATE_SALE' });
          const keyMap: any = {
            employeeId: 'employee_id', employeeEmail: 'employee_email', customerEmail: 'customer_email', customerPhone: 'customer_phone', productId: 'product_id', productName: 'product_name', amount: 'amount', status: 'status', timestamp: 'timestamp', paymentMethod: 'payment_method'
          };
          const allowed = ['employee_id','employee_email','customer_email','customer_phone','product_id','product_name','amount','status','timestamp','payment_method'];
          const out: any = {};
          Object.keys(payload || {}).forEach(k => {
            const mapped = keyMap[k] || k;
            if (allowed.includes(mapped)) out[mapped] = payload[k];
          });
          if (out.amount !== undefined) out.amount = Number(out.amount);
          const { data, error } = await supabase.from('sales').update(out).eq('id', payload.id).select();
          if (error) return res.status(500).json({ error: 'Failed to update sale', details: error });
          return res.status(200).json({ success: true, stored: data && data[0] });
        }
        case 'UPDATE_PRODUCT': {
          const keyMap: any = {
            id: 'id', name: 'name', description: 'description', pricingModel: 'pricing_model', pricing_model: 'pricing_model', adminShare: 'admin_share', admin_share: 'admin_share', commissionPercent: 'commission_percent', commission_percent: 'commission_percent', gallery: 'gallery', mainImage: 'main_image', main_image: 'main_image'
          };
          const allowed = ['id','name','description','pricing_model','admin_share','commission_percent','gallery','main_image'];
          function sanitizeProduct(p: any) {
            const out: any = {};
            Object.keys(p || {}).forEach(k => {
              const mapped = keyMap[k] || k;
              if (allowed.includes(mapped)) out[mapped] = p[k];
            });
            return out;
          }
          if (Array.isArray(payload)) {
            const sanitized = payload.map(sanitizeProduct);
            await supabase.from('products').upsert(sanitized, { onConflict: 'id' });
          } else if (payload && payload.id) {
            const sanitized = sanitizeProduct(payload);
            await supabase.from('products').upsert([sanitized], { onConflict: 'id' });
          }
          break;
        }
        default:
          return res.status(400).json({ error: 'Unknown action' });
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('POST DB Write Error (Next API):', error);
      return res.status(500).json({ error: 'Failed to write to database' });
    }
  }
}
