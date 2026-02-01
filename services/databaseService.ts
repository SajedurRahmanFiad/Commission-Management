/**
 * Database Service
 * Handles all API calls to fetch and append data from the JSON database files
 */

export interface DatabaseResponse {
  users: any[];
  sales: any[];
  products: any[];
  announcements: any[];
  withdrawRequests: any[];
  adminWallet: number;
}

const API_BASE = `/api/db`;

/**
 * Fetch all data from database files
 */
export const fetchDatabaseState = async (): Promise<DatabaseResponse | null> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch database state:', response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('Fetched database state from /api/db:', data);
    return data;
  } catch (error) {
    console.error('Error fetching database state:', error);
    return null;
  }
};

/**
 * Append a new sale to the sales database
 */
export const appendSale = async (saleData: any): Promise<{ ok: boolean; stored?: any; body?: any }> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'APPEND_SALE',
        payload: saleData,
      }),
    });

    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }

    if (!response.ok) {
      console.error('Error appending sale - response not OK:', response.status, response.statusText, 'body:', json);
      return { ok: false, body: json };
    }

    return { ok: true, stored: json && json.stored ? json.stored : undefined, body: json };
  } catch (error) {
    console.error('Error appending sale:', error);
    return { ok: false, body: String(error) };
  }
};

/**
 * Append a new announcement to the announcements database
 */
export const appendAnnouncement = async (announcementData: any): Promise<{ ok: boolean; stored?: any; body?: any }> => {
  try {
    console.log('Appending announcement:', announcementData);
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'APPEND_ANNOUNCEMENT',
        payload: announcementData,
      }),
    });

    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }

    if (!response.ok) {
      console.error('Error appending announcement - response not OK:', response.status, response.statusText, 'body:', json);
      return { ok: false, body: json };
    }

    return { ok: true, stored: json && json.stored ? json.stored : undefined, body: json };
  } catch (error) {
    console.error('Error appending announcement:', error);
    return { ok: false, body: String(error) };
  }
};

/**
 * Append a new withdrawal request to the withdrawals database
 */
export const appendWithdrawal = async (withdrawalData: any): Promise<{ ok: boolean; stored?: any; body?: any }> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'APPEND_WITHDRAWAL',
        payload: withdrawalData,
      }),
    });

    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }

    if (!response.ok) {
      console.error('Error appending withdrawal - response not OK:', response.status, response.statusText, 'body:', json);
      return { ok: false, body: json };
    }

    return { ok: true, stored: json && json.stored ? json.stored : undefined, body: json };
  } catch (error) {
    console.error('Error appending withdrawal:', error);
    return { ok: false, body: String(error) };
  }
};

/**
 * Update an existing announcement in the announcements database
 */
export const updateAnnouncement = async (announcementData: any): Promise<{ ok: boolean; stored?: any; body?: any }> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'UPDATE_ANNOUNCEMENT',
        payload: announcementData,
      }),
    });

    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }

    if (!response.ok) {
      console.error('Error updating announcement - response not OK:', response.status, response.statusText, 'body:', json);
      return { ok: false, body: json };
    }

    return { ok: true, stored: json && json.stored ? json.stored : undefined, body: json };
  } catch (error) {
    console.error('Error updating announcement:', error);
    return { ok: false, body: String(error) };
  }
};

/**
 * Delete an announcement from the announcements database
 */
export const deleteAnnouncement = async (announcementId: string): Promise<boolean> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'DELETE_ANNOUNCEMENT',
        payload: { id: announcementId },
      }),
    });

    if (!response.ok) {
      console.error('Error deleting announcement - response not OK:', response.status, response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return false;
  }
};

/**
 * Update an existing withdrawal request in the withdrawals database
 */
export const updateWithdrawal = async (withdrawalData: any): Promise<{ ok: boolean; stored?: any; body?: any }> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'UPDATE_WITHDRAWAL',
        payload: withdrawalData,
      }),
    });

    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }

    if (!response.ok) {
      console.error('Error updating withdrawal - response not OK:', response.status, response.statusText, 'body:', json);
      return { ok: false, body: json };
    }

    return { ok: true, stored: json && json.stored ? json.stored : undefined, body: json };
  } catch (error) {
    console.error('Error updating withdrawal:', error);
    return { ok: false, body: String(error) };
  }
};

/**
 * Update an existing user in the users database
 */
export const updateUser = async (userData: any): Promise<any | null> => {
  try {
    console.log('Updating user:', userData);
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'UPDATE_USER',
        payload: userData,
      }),
    });

    if (!response.ok) {
      let bodyText = '';
      try {
        const text = await response.text();
        try {
          bodyText = JSON.stringify(JSON.parse(text));
        } catch {
          bodyText = text;
        }
      } catch (e) {
        bodyText = '<unreadable response body>';
      }
      console.error('Error updating user - response not OK:', response.status, response.statusText, 'body:', bodyText);
      return null;
    }
    
    const result = await response.json();
    console.log('User update result:', result);
    if (result && result.droppedColumns && Array.isArray(result.droppedColumns) && result.droppedColumns.length) {
      console.warn('Server dropped profile columns during upsert:', result.droppedColumns);
      if (result.droppedColumns.includes('password')) {
        console.warn('Note: password was not persisted to the database (missing column). The created user will not be able to login until you add a `password` column or enable Supabase Auth.');
      }
    }

    if (result && result.stored) {
      console.log('Stored row returned from server for user update:', result.stored);
    }

    return result;
  } catch (error) {
    console.error('Error updating user:', error);
    return null;
  }
};

/**
 * Login via server
 */
export const login = async (email: string, password: string): Promise<any | null> => {
  try {
    const res = await fetch(`/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch (err) {
    console.error('Login error:', err);
    return null;
  }
};

/**
 * Update an existing sale in the sales database
 */
export const updateSale = async (saleData: any): Promise<boolean> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'UPDATE_SALE',
        payload: saleData,
      }),
    });

    if (!response.ok) {
      let bodyText = '<unreadable response body>';
      try { const text = await response.text(); try { bodyText = JSON.stringify(JSON.parse(text)); } catch { bodyText = text; } } catch (e) { /* ignore */ }
      console.error('Error updating sale - response not OK:', response.status, response.statusText, 'body:', bodyText);
      return false;
    }

    const json = await response.json();
    if (json && json.success !== false) return true;
    console.error('Update sale failed:', json);
    return false;
  } catch (error) {
    console.error('Error updating sale:', error);
    return false;
  }
};

/**
 * Update products in the products database
 */
export const updateProducts = async (productsData: any[]): Promise<boolean> => {
  try {
    console.log('Updating products:', productsData);
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'UPDATE_PRODUCT',
        payload: productsData,
      }),
    });

    if (!response.ok) {
      let body = '<unreadable response body>';
      try { const text = await response.text(); try { body = JSON.stringify(JSON.parse(text)); } catch { body = text; } } catch (e) { /* ignore */ }
      console.error('Error updating products - response not OK:', response.status, response.statusText, 'body:', body);
      return false;
    }
    
    const result = await response.json();
    console.log('Product update result:', result);
    return result && result.success !== false;
  } catch (error) {
    console.error('Error updating products:', error);
    return false;
  }
};

/**
 * Sync entire state to database (use with caution)
 * This will overwrite data, so it's only for initialization
 */
export const syncStateToDatabase = async (state: any): Promise<boolean> => {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'SYNC_STATE',
        payload: state,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error syncing state to database:', error);
    return false;
  }
};
/**
 * Search products by query using server-side filter
 */
// Normalize product row from DB to UI-friendly shape
const normalizeProductForService = (p: any) => {
  if (!p) return p;
  const gallery = Array.isArray(p.gallery) ? p.gallery : (p.gallery ? (typeof p.gallery === 'string' ? (() => {
    try { return JSON.parse(p.gallery); } catch { return []; }
  })() : p.gallery) : []);
  return {
    ...p,
    pricingModel: p.pricing_model || p.pricingModel || 'fixed',
    adminShare: p.admin_share !== undefined ? Number(p.admin_share) : (p.adminShare ?? 0),
    commissionPercent: p.commission_percent !== undefined ? Number(p.commission_percent) : (p.commissionPercent ?? undefined),
    gallery,
    mainImage: p.main_image || p.mainImage || undefined
  };
};

export const searchProducts = async (q: string): Promise<any[]> => {
  try {
    const response = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map(normalizeProductForService);
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
};

/**
 * Search users by query and optional role
 */
export const searchUsers = async (q: string, role?: string): Promise<any[]> => {
  try {
    const rolePart = role ? `&role=${encodeURIComponent(role)}` : '';
    const response = await fetch(`/api/users?q=${encodeURIComponent(q)}${rolePart}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
};

/**
 * Search sales
 */
// Normalize sale row from DB to UI-friendly shape
const normalizeSaleForService = (s: any) => {
  if (!s) return s;
  return {
    ...s,
    id: s.id,
    employeeId: s.employee_id || s.employeeId || s.employee,
    employeeEmail: s.employee_email || s.employeeEmail || '',
    customerEmail: s.customer_email || s.customerEmail || '',
    customerPhone: s.customer_phone || s.customerPhone || '',
    productId: s.product_id || s.productId || '',
    productName: s.product_name || s.productName || '',
    amount: s.amount !== undefined ? Number(s.amount) : (s.amount || 0),
    paymentMethod: s.payment_method || s.paymentMethod || s.paymentType || 'bKash',
    status: s.status || 'pending',
    timestamp: s.timestamp || s.created_at || new Date().toISOString(),
    approvedAt: s.approved_at || s.approvedAt || undefined
  };
};

export const searchSales = async (q: string): Promise<any[]> => {
  try {
    const response = await fetch(`/api/sales?q=${encodeURIComponent(q)}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map(normalizeSaleForService);
  } catch (error) {
    console.error('Error searching sales:', error);
    return [];
  }
};

/**
 * Search withdrawals
 */
export const searchWithdrawals = async (q: string): Promise<any[]> => {
  try {
    const response = await fetch(`/api/withdrawals?q=${encodeURIComponent(q)}`);
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Error searching withdrawals:', error);
    return [];
  }
};

/**
 * Upload a file (avatar or product image) to the server
 */
export const uploadFile = async (file: File, type: 'avatar' | 'product'): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/upload?type=${type}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let body = '<unreadable response body>';
      try {
        const text = await response.text();
        try { body = JSON.stringify(JSON.parse(text)); } catch { body = text; }
      } catch (e) { /* ignore */ }
      console.error('Failed to upload file:', response.status, response.statusText, 'body:', body);
      return null;
    }

    const data = await response.json();
    console.log(`File uploaded successfully: ${data.filePath}`, data);
    return data.filePath;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
};