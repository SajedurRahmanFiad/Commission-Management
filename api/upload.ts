import { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import path from 'path';
import { supabase } from '../services/supabaseClient';

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const config = {
  api: {
    bodyParser: false,
  },
};

function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: Function) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  await runMiddleware(req, res, upload.single('file'));
  const file = (req as any).file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });
  const type = (req.query.type as string) || 'product';
  const fileExt = path.extname(file.originalname) || '';
  const filename = `${Date.now()}${fileExt}`;
  const key = `${type}/${filename}`;
  try {
    const { data, error } = await supabase.storage.from('uploads').upload(key, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });
    if (error) throw error;
    const pub = supabase.storage.from('uploads').getPublicUrl(key);
    const publicURL = (pub as any)?.data?.publicUrl || (pub as any)?.publicURL || '';
    return res.status(200).json({ success: true, filePath: publicURL, filename });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to upload file', details: err });
  }
}
