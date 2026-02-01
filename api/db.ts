
import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../services/supabaseClient';

const HAS_SUPABASE = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Define default admin for recovery/seeding
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

      // Calculate admin wallet similar to previous logic
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

      return res.status(200).json({
        users,
        sales,
        products,
        announcements,
        withdrawRequests: withdrawals,
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
        case 'APPEND_SALE':
          if (payload) await supabase.from('sales').insert([payload]);
          break;
        case 'UPDATE_USER':
          // ...existing code for UPDATE_USER...
          break;
        case 'APPEND_ANNOUNCEMENT': {
          try {
            const { data, error } = await supabase.from('announcements').insert([payload]).select();
            if (error) {
              console.error('Supabase insert announcement error (Next API):', error);
              return res.status(500).json({ error: 'Failed to append announcement', details: error });
            }
            return res.status(200).json({ success: true, stored: data && data[0] });
          } catch (err: any) {
            console.error('APPEND_ANNOUNCEMENT handler error (Next API):', err);
            return res.status(500).json({ error: 'Failed to append announcement', details: String(err) });
          }
        }
        case 'UPDATE_ANNOUNCEMENT': {
          try {
            const sanitizeAnnouncementUpdate = (a: any) => {
              const keyMap: any = { seenBy: 'seen_by' };
              const allowed = ['title','content','timestamp','seen_by'];
              const out: any = {};
              Object.keys(a || {}).forEach(k => {
                const mapped = keyMap[k] || k;
                if (allowed.includes(mapped)) out[mapped] = a[k];
              });
              return out;
            };
            const id = payload?.id;
            if (!id) {
              console.warn('UPDATE_ANNOUNCEMENT (Next API) called without id');
              break;
            }
            const sanitized = sanitizeAnnouncementUpdate(payload);
            const { data, error } = await supabase.from('announcements').update(sanitized).eq('id', id).select();
            if (error) {
              console.error('Supabase update announcement error (Next API):', error);
              return res.status(500).json({ error: 'Failed to update announcement', details: error });
            }
            return res.status(200).json({ success: true, stored: data && data[0] });
          } catch (e) {
            console.error('UPDATE_ANNOUNCEMENT handler error (Next API):', e);
            return res.status(500).json({ error: 'Failed to update announcement', details: String(e) });
          }
        }
        case 'DELETE_ANNOUNCEMENT':
          if (payload) await supabase.from('announcements').delete().eq('id', payload.id);
          break;
        case 'APPEND_WITHDRAWAL': {
          try {
            const sanitizeW = (w: any) => {
              const keyMap: any = { employeeId: 'employee_id', employeeEmail: 'employee_email', accountNumber: 'account_number' };
              const allowed = ['id','employee_id','employee_email','amount','method','account_number','status','timestamp'];
              const out: any = {};
              Object.keys(w || {}).forEach(k => {
                const mapped = keyMap[k] || k;
                if (allowed.includes(mapped)) out[mapped] = w[k];
              });
              if (out.amount !== undefined) out.amount = Number(out.amount);
              return out;
            };
            const isUUID = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);

            let sanitized = sanitizeW(payload);

            if (sanitized.id && !isUUID(sanitized.id)) {
              console.warn('Dropping non-UUID withdraw id before insert (was temp id):', sanitized.id);
              delete sanitized.id;
            }

            if (sanitized.employee_id && !isUUID(sanitized.employee_id)) {
              if (sanitized.employee_email) {
                try {
                  const { data: found, error: findErr } = await supabase.from('profiles').select('id').ilike('email', sanitized.employee_email).limit(1).maybeSingle();
                  if (findErr) console.warn('Error finding profile by email while inserting withdrawal (Next API):', findErr);
                  if (found && found.id && isUUID(found.id)) sanitized.employee_id = found.id;
                  else { console.warn('Dropping non-UUID employee_id from withdrawal insert (Next API); fallback to employee_email', sanitized.employee_id); delete sanitized.employee_id; }
                } catch (e) {
                  console.warn('Exception while looking up profile for withdrawal insert (Next API):', e);
                  delete sanitized.employee_id;
                }
              } else {
                console.warn('Dropping non-UUID employee_id from withdrawal insert (Next API; no employee_email available):', sanitized.employee_id);
                delete sanitized.employee_id;
              }
            }

            const { data, error } = await supabase.from('withdraw_requests').insert([sanitized]).select();
            if (error) {
              console.error('Supabase insert withdrawal error (Next API):', error);
              const msg = (error && (error.message || error.details || JSON.stringify(error))) || String(error);
              if (/duplicate key|already exists|unique constraint/i.test(msg) || (error.code && String(error.code) === '23505')) {
                console.warn('Duplicate withdraw id detected (Next API); retrying insert without id');
                delete sanitized.id;
                const retry = await supabase.from('withdraw_requests').insert([sanitized]).select();
                if (retry.error) { console.error('Supabase insert withdrawal retry failed (Next API):', retry.error); return res.status(500).json({ error: 'Failed to append withdrawal', details: retry.error }); }
                return res.status(200).json({ success: true, stored: retry.data && retry.data[0] });
              }
              return res.status(500).json({ error: 'Failed to append withdrawal', details: error });
            }
            return res.status(200).json({ success: true, stored: data && data[0] });
          } catch (err: any) {
            console.error('APPEND_WITHDRAWAL handler error (Next API):', err);
            return res.status(500).json({ error: 'Failed to append withdrawal', details: String(err) });
          }
        }
        case 'UPDATE_WITHDRAWAL': {
          try {
            if (!payload || !payload.id) return res.status(400).json({ error: 'id is required for UPDATE_WITHDRAWAL' });
            const keyMap: any = { employeeId: 'employee_id', employeeEmail: 'employee_email', accountNumber: 'account_number' };
            const allowed = ['employee_id','employee_email','amount','method','account_number','status','timestamp'];
            const updateObj: any = {};
            Object.keys(payload || {}).forEach(k => {
              const mapped = keyMap[k] || k;
              if (allowed.includes(mapped)) updateObj[mapped] = payload[k];
            });
            if (updateObj.amount !== undefined) updateObj.amount = Number(updateObj.amount);
            const { data, error } = await supabase.from('withdraw_requests').update(updateObj).eq('id', payload.id).select();
            if (error) {
              console.error('Supabase update withdrawal error (Next API):', error);
              return res.status(500).json({ error: 'Failed to update withdrawal', details: error });
            }
            return res.status(200).json({ success: true, stored: data && data[0] });
          } catch (err: any) {
            console.error('UPDATE_WITHDRAWAL handler error (Next API):', err);
            return res.status(500).json({ error: 'Failed to update withdrawal', details: String(err) });
          }
        }
        case 'UPDATE_SALE':
          if (payload) await supabase.from('sales').update(payload).eq('id', payload.id);
          break;
        case 'UPDATE_PRODUCT':
          if (Array.isArray(payload)) await supabase.from('products').upsert(payload, { onConflict: 'id' });
          else if (payload && payload.id) await supabase.from('products').upsert([payload], { onConflict: 'id' });
          break;
        default:
          return res.status(400).json({ error: 'Unknown action' });
      }
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('POST DB Write Error (Next API):', error);
      return res.status(500).json({ error: 'Failed to write to database' });
    }
  }

      switch (action) {
        case 'SYNC_STATE':
          if (payload.users) await supabase.from('profiles').upsert(payload.users, { onConflict: 'id' });
          if (payload.sales) await supabase.from('sales').upsert(payload.sales, { onConflict: 'id' });
          if (payload.products) await supabase.from('products').upsert(payload.products, { onConflict: 'id' });
          if (payload.announcements) await supabase.from('announcements').upsert(payload.announcements, { onConflict: 'id' });
          if (payload.withdrawRequests) await supabase.from('withdraw_requests').upsert(payload.withdrawRequests, { onConflict: 'id' });
          break;

        case 'APPEND_SALE':
          await supabase.from('sales').insert([payload]);
          break;

        case 'UPDATE_USER':
          console.log('UPDATE_USER payload (Next API):', {
            id: payload?.id,
            email: payload?.email,
            role: payload?.role,
            wallet: payload?.wallet,
            totalSalesCount: payload?.totalSalesCount,
            username: payload?.username,
            avatar: payload?.avatar,
            password: payload?.password ? '***' : undefined,
          });
          try {
            // Whitelist known profile columns to avoid Supabase errors for unknown columns
            const allowedKeys = ['id','email','password','role','wallet','username','avatar','total_sales_count','bkash_number','nagad_number','rocket_number'];
            const keyMap: any = { totalSalesCount: 'total_sales_count', total_sales_count: 'total_sales_count', bkashNumber: 'bkash_number', nagadNumber: 'nagad_number', rocketNumber: 'rocket_number' };
            const sanitized: any = {};

            Object.keys(payload || {}).forEach((k) => {
              if (keyMap[k]) sanitized[keyMap[k]] = payload[k];
              else if (allowedKeys.includes(k)) sanitized[k] = payload[k];
            });

            // Normalize email to lowercase if present
            if (payload?.email && !sanitized.email) sanitized.email = payload.email.toString().toLowerCase();

            // Log dropped keys for visibility
            const dropped = Object.keys(payload || {}).filter(k => !(allowedKeys.includes(k) || Object.keys(keyMap).includes(k)));
            if (dropped.length) console.warn('UPDATE_USER (Next API) dropping unknown profile fields:', dropped);

            // Try upsert, and if Supabase reports missing columns, drop them and retry
            const isUUID = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);

            const tryUpsert = async (obj: any) => {
              try {
                let idWasTemp: string | null = null;
                if (obj.id && !isUUID(obj.id)) {
                  idWasTemp = obj.id;
                  delete obj.id;
                  console.warn('Dropping non-UUID id before upsert (Next API), was temp id:', idWasTemp);
                }

                    const { data, error } = await supabase.from('profiles').upsert([obj], { onConflict: 'id' }).select();
                    if (error) throw error;
                    const returnedId = (data && data[0] && data[0].id) ? data[0].id : null;
                    const stored = (data && data[0]) || null;
                    return { success: true, dropped: [], id: returnedId, idWasTemp, stored };
                  } catch (err: any) {
                    const msg = (err && (err.message || err.error_description || err.details || JSON.stringify(err))) || String(err);
                    const missingCols: string[] = [];
                    const regex = /Could not find the '([^']+)' column/gi;
                    let m: RegExpExecArray | null;
                    while ((m = regex.exec(msg)) !== null) {
                      missingCols.push(m[1]);
                    }

                    if (missingCols.length) {
                      missingCols.forEach(c => delete obj[c]);
                      console.warn('Upsert retry dropping missing columns (Next API):', missingCols);
                      const { data: data2, error: err2 } = await supabase.from('profiles').upsert([obj], { onConflict: 'id' }).select();
                      if (err2) {
                        console.error('Supabase upsert retry error (Next API):', err2);
                        throw err2;
                      }
                      const returnedId = (data2 && data2[0] && data2[0].id) ? data2[0].id : null;
                      const stored = (data2 && data2[0]) || null;
                      return { success: true, dropped: missingCols, id: returnedId, stored };
              if (resUp.id) return res.status(200).json({ success: true, id: resUp.id });
            } else if (sanitized.email) {
              const hadTempId = !!(sanitized.id && !isUUID(sanitized.id));
              if (hadTempId) delete sanitized.id;

              const { data: findData, error: findError } = await supabase.from('profiles').select('id').eq('email', sanitized.email).limit(1).maybeSingle();
              if (findError) {
                console.error('Supabase select error (Next API, find by email):', findError);
                return res.status(500).json({ error: findError.message || findError });
              }
              if (findData?.id) sanitized.id = findData.id;

              const resUp = await tryUpsert(sanitized);
              if (resUp.dropped && resUp.dropped.length) return res.status(200).json({ success: true, droppedColumns: resUp.dropped, id: resUp.id });
              if (resUp.id) {
                return res.status(200).json({ success: true, id: resUp.id, idWasTemp: resUp.idWasTemp });
              }
            }
          } catch (e) {
            console.error('UPDATE_USER handler error (Next API):', e);
            return res.status(500).json({ error: e.message || e });
          }
          break;

        case 'APPEND_ANNOUNCEMENT': {
          try {
            const { data, error } = await supabase.from('announcements').insert([payload]).select();
            if (error) {
              console.error('Supabase insert announcement error (Next API):', error);
              return res.status(500).json({ error: 'Failed to append announcement', details: error });
            }
            return res.status(200).json({ success: true, stored: data && data[0] });
          } catch (err: any) {
            console.error('APPEND_ANNOUNCEMENT handler error (Next API):', err);
            return res.status(500).json({ error: 'Failed to append announcement', details: String(err) });
          }
        }

        case 'UPDATE_ANNOUNCEMENT': {
          try {
            const sanitizeAnnouncementUpdate = (a: any) => {
              const keyMap: any = { seenBy: 'seen_by' };
              const allowed = ['title','content','timestamp','seen_by'];
              const out: any = {};
              Object.keys(a || {}).forEach(k => {
                const mapped = keyMap[k] || k;
                if (allowed.includes(mapped)) out[mapped] = a[k];
              });
              return out;
            };
            const id = payload?.id;
            if (!id) {
              console.warn('UPDATE_ANNOUNCEMENT (Next API) called without id');
              break;
            }
            const sanitized = sanitizeAnnouncementUpdate(payload);
            const { data, error } = await supabase.from('announcements').update(sanitized).eq('id', id).select();
            if (error) {
              console.error('Supabase update announcement error (Next API):', error);
              return res.status(500).json({ error: 'Failed to update announcement', details: error });
            }
            return res.status(200).json({ success: true, stored: data && data[0] });
          } catch (e) {
            console.error('UPDATE_ANNOUNCEMENT handler error (Next API):', e);
            return res.status(500).json({ error: 'Failed to update announcement', details: String(e) });
          }
        }

        case 'DELETE_ANNOUNCEMENT':
          await supabase.from('announcements').delete().eq('id', payload.id);
          break;

        case 'APPEND_WITHDRAWAL': {
          try {
            const sanitizeW = (w: any) => {
              const keyMap: any = { employeeId: 'employee_id', employeeEmail: 'employee_email', accountNumber: 'account_number' };
              const allowed = ['id','employee_id','employee_email','amount','method','account_number','status','timestamp'];
              const out: any = {};
              Object.keys(w || {}).forEach(k => {
                const mapped = keyMap[k] || k;
                if (allowed.includes(mapped)) out[mapped] = w[k];
              });
              if (out.amount !== undefined) out.amount = Number(out.amount);
              return out;
            };
            const isUUID = (s: any) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(s);

            let sanitized = sanitizeW(payload);

            if (sanitized.id && !isUUID(sanitized.id)) {
              console.warn('Dropping non-UUID withdraw id before insert (was temp id):', sanitized.id);
              delete sanitized.id;
            }

            if (sanitized.employee_id && !isUUID(sanitized.employee_id)) {
              if (sanitized.employee_email) {
                try {
                  const { data: found, error: findErr } = await supabase.from('profiles').select('id').ilike('email', sanitized.employee_email).limit(1).maybeSingle();
                  if (findErr) console.warn('Error finding profile by email while inserting withdrawal (Next API):', findErr);
                  if (found && found.id && isUUID(found.id)) sanitized.employee_id = found.id;
                  else { console.warn('Dropping non-UUID employee_id from withdrawal insert (Next API); fallback to employee_email', sanitized.employee_id); delete sanitized.employee_id; }
                } catch (e) {
                  console.warn('Exception while looking up profile for withdrawal insert (Next API):', e);
                  delete sanitized.employee_id;
                }
              } else {
                console.warn('Dropping non-UUID employee_id from withdrawal insert (Next API; no employee_email available):', sanitized.employee_id);
                delete sanitized.employee_id;
              }
            }

            const { data, error } = await supabase.from('withdraw_requests').insert([sanitized]).select();
            if (error) {
              console.error('Supabase insert withdrawal error (Next API):', error);
              const msg = (error && (error.message || error.details || JSON.stringify(error))) || String(error);
              if (/duplicate key|already exists|unique constraint/i.test(msg) || (error.code && String(error.code) === '23505')) {
                console.warn('Duplicate withdraw id detected (Next API); retrying insert without id');
                delete sanitized.id;
                const retry = await supabase.from('withdraw_requests').insert([sanitized]).select();
                if (retry.error) { console.error('Supabase insert withdrawal retry failed (Next API):', retry.error); return res.status(500).json({ error: 'Failed to append withdrawal', details: retry.error }); }
                return res.status(200).json({ success: true, stored: retry.data && retry.data[0] });
              }
              return res.status(500).json({ error: 'Failed to append withdrawal', details: error });
            }
            return res.status(200).json({ success: true, stored: data && data[0] });
          } catch (err: any) {
            console.error('APPEND_WITHDRAWAL handler error (Next API):', err);
            return res.status(500).json({ error: 'Failed to append withdrawal', details: String(err) });
          }
        }

        case 'UPDATE_WITHDRAWAL': {
          try {
            if (!payload || !payload.id) return res.status(400).json({ error: 'id is required for UPDATE_WITHDRAWAL' });
            const keyMap: any = { employeeId: 'employee_id', employeeEmail: 'employee_email', accountNumber: 'account_number' };
            const allowed = ['employee_id','employee_email','amount','method','account_number','status','timestamp'];
            const updateObj: any = {};
            Object.keys(payload || {}).forEach(k => {
              const mapped = keyMap[k] || k;
              if (allowed.includes(mapped)) updateObj[mapped] = payload[k];
            });
            if (updateObj.amount !== undefined) updateObj.amount = Number(updateObj.amount);
            const { data, error } = await supabase.from('withdraw_requests').update(updateObj).eq('id', payload.id).select();
            if (error) {
              console.error('Supabase update withdrawal error (Next API):', error);
              return res.status(500).json({ error: 'Failed to update withdrawal', details: error });
            }
            return res.status(200).json({ success: true, stored: data && data[0] });
          } catch (err: any) {
            console.error('UPDATE_WITHDRAWAL handler error (Next API):', err);
            return res.status(500).json({ error: 'Failed to update withdrawal', details: String(err) });
          }
        }

        case 'UPDATE_SALE':
          await supabase.from('sales').update(payload).eq('id', payload.id);
          break;

        case 'UPDATE_PRODUCT':
          if (Array.isArray(payload)) await supabase.from('products').upsert(payload, { onConflict: 'id' });
          else if (payload.id) await supabase.from('products').upsert([payload], { onConflict: 'id' });
          break;

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
