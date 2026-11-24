import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // for HTTP-only cookie
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor - attach access token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('_at');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiClient.post('/auth/refresh');
        const newToken = data.data.accessToken;
        sessionStorage.setItem('_at', newToken);
        processQueue(null, newToken);
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        sessionStorage.removeItem('_at');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ---- Auth API ----
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  logout: () => apiClient.post('/auth/logout'),
  logoutAll: () => apiClient.post('/auth/logout-all'),
  refresh: () => apiClient.post('/auth/refresh'),
  me: () => apiClient.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),
  getSessions: () => apiClient.get('/auth/sessions'),
  revokeSession: (sessionId: string) => apiClient.delete(`/auth/sessions/${sessionId}`),
};

// ---- Mail API ----
export const mailApi = {
  getInbox: (accountId: string, page = 1, limit = 50) =>
    apiClient.get('/mail/inbox', { params: { accountId, page, limit } }),
  getStarred: (accountId: string, page = 1) =>
    apiClient.get('/mail/starred', { params: { accountId, page } }),
  getFolder: (folder: string, accountId: string, page = 1, limit = 50) =>
    apiClient.get(`/mail/folder/${folder}`, { params: { accountId, page, limit } }),
  getEmail: (id: string) => apiClient.get(`/mail/${id}`),
  sendEmail: (data: unknown) => apiClient.post('/mail/send', data),
  saveDraft: (data: unknown) => apiClient.post('/mail/draft', data),
  updateDraft: (id: string, data: unknown) => apiClient.put(`/mail/draft/${id}`, data),
  markRead: (id: string) => apiClient.post(`/mail/${id}/read`),
  markUnread: (id: string) => apiClient.post(`/mail/${id}/unread`),
  star: (id: string) => apiClient.post(`/mail/${id}/star`),
  unstar: (id: string) => apiClient.post(`/mail/${id}/unstar`),
  archive: (id: string) => apiClient.post(`/mail/${id}/archive`),
  move: (id: string, folderId: string) => apiClient.post(`/mail/${id}/move`, { folderId }),
  delete: (id: string, permanent?: boolean) =>
    apiClient.delete(`/mail/${id}`, { params: { permanent } }),
  search: (params: Record<string, unknown>) =>
    apiClient.get('/mail/search', { params }),
  // Bulk
  bulkRead: (ids: string[]) => apiClient.post('/mail/bulk/read', { ids }),
  bulkUnread: (ids: string[]) => apiClient.post('/mail/bulk/unread', { ids }),
  bulkDelete: (ids: string[], permanent?: boolean) =>
    apiClient.post('/mail/bulk/delete', { ids, permanent }),
  bulkMove: (ids: string[], folderId: string) =>
    apiClient.post('/mail/bulk/move', { ids, folderId }),
};

// ---- Folders API ----
export const foldersApi = {
  getFolders: (accountId: string) => apiClient.get('/folders', { params: { accountId } }),
  createFolder: (accountId: string, name: string, parentId?: string) =>
    apiClient.post('/folders', { accountId, name, parentId }),
  renameFolder: (id: string, name: string) => apiClient.put(`/folders/${id}`, { name }),
  deleteFolder: (id: string) => apiClient.delete(`/folders/${id}`),
};

// ---- Contacts API ----
export const contactsApi = {
  getContacts: (search?: string) => apiClient.get('/contacts', { params: { q: search } }),
  autocomplete: (query: string) => apiClient.get('/contacts/autocomplete', { params: { q: query } }),
  createContact: (data: unknown) => apiClient.post('/contacts', data),
  updateContact: (id: string, data: unknown) => apiClient.put(`/contacts/${id}`, data),
  deleteContact: (id: string) => apiClient.delete(`/contacts/${id}`),
};

// ---- Settings API ----
export const settingsApi = {
  getSettings: () => apiClient.get('/settings'),
  updateSettings: (data: unknown) => apiClient.put('/settings', data),
  getSignatures: () => apiClient.get('/settings/signatures'),
  createSignature: (data: unknown) => apiClient.post('/settings/signatures', data),
  updateSignature: (id: string, data: unknown) => apiClient.put(`/settings/signatures/${id}`, data),
  deleteSignature: (id: string) => apiClient.delete(`/settings/signatures/${id}`),
};

// ---- Users API ----
export const usersApi = {
  getProfile: () => apiClient.get('/users/me'),
  updateProfile: (data: unknown) => apiClient.put('/users/me', data),
  getMailAccounts: () => apiClient.get('/users/me/accounts'),
  getQuota: () => apiClient.get('/users/me/quota'),
};

// ---- Admin API ----
export const adminApi = {
  getDashboard: () => apiClient.get('/admin/dashboard'),
  getUsers: (page = 1, search?: string) =>
    apiClient.get('/admin/users', { params: { page, q: search } }),
  createUser: (data: unknown) => apiClient.post('/admin/users', data),
  updateStatus: (id: string, status: string) =>
    apiClient.put(`/admin/users/${id}/status`, { status }),
  resetPassword: (id: string, password: string) =>
    apiClient.post(`/admin/users/${id}/reset-password`, { password }),
  deleteUser: (id: string) => apiClient.delete(`/admin/users/${id}`),
  getAuditLogs: (page = 1) => apiClient.get('/admin/audit-logs', { params: { page } }),
};

// ---- Health API ----
export const healthApi = {
  check: () => apiClient.get('/health', { baseURL: process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') }),
};
