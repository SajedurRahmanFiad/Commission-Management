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

const API_BASE = '/api/db';

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
export const appendSale = async (saleData: any): Promise<boolean> => {
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

    return response.ok;
  } catch (error) {
    console.error('Error appending sale:', error);
    return false;
  }
};

/**
 * Append a new announcement to the announcements database
 */
export const appendAnnouncement = async (announcementData: any): Promise<boolean> => {
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

    if (!response.ok) {
      console.error('Error appending announcement - response not OK:', response.status, response.statusText);
      return false;
    }

    const result = await response.json();
    console.log('Announcement append result:', result);
    return true;
  } catch (error) {
    console.error('Error appending announcement:', error);
    return false;
  }
};

/**
 * Append a new withdrawal request to the withdrawals database
 */
export const appendWithdrawal = async (withdrawalData: any): Promise<boolean> => {
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

    return response.ok;
  } catch (error) {
    console.error('Error appending withdrawal:', error);
    return false;
  }
};

/**
 * Update an existing announcement in the announcements database
 */
export const updateAnnouncement = async (announcementData: any): Promise<boolean> => {
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

    if (!response.ok) {
      console.error('Error updating announcement - response not OK:', response.status, response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating announcement:', error);
    return false;
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
export const updateWithdrawal = async (withdrawalData: any): Promise<boolean> => {
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

    return response.ok;
  } catch (error) {
    console.error('Error updating withdrawal:', error);
    return false;
  }
};

/**
 * Update an existing user in the users database
 */
export const updateUser = async (userData: any): Promise<boolean> => {
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
      console.error('Error updating user - response not OK:', response.status, response.statusText);
      return false;
    }
    
    const result = await response.json();
    console.log('User update result:', result);
    return true;
  } catch (error) {
    console.error('Error updating user:', error);
    return false;
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

    return response.ok;
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
      console.error('Error updating products - response not OK:', response.status, response.statusText);
      return false;
    }
    
    const result = await response.json();
    console.log('Product update result:', result);
    return true;
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
export const searchProducts = async (q: string): Promise<any[]> => {
  try {
    const response = await fetch(`/api/products?q=${encodeURIComponent(q)}`);
    if (!response.ok) return [];
    return await response.json();
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
export const searchSales = async (q: string): Promise<any[]> => {
  try {
    const response = await fetch(`/api/sales?q=${encodeURIComponent(q)}`);
    if (!response.ok) return [];
    return await response.json();
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
      console.error('Failed to upload file:', response.statusText);
      return null;
    }

    const data = await response.json();
    console.log(`File uploaded successfully: ${data.filePath}`);
    return data.filePath;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
};