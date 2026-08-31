import axios from 'axios';
import type {
  User,
  LoginCredentials,
  TokenResponse,
  Faculty,
  Payer,
  Payment,
  PayerCreate,
  PaymentCreate,
  PaymentSettings,
  PaymentSettingsCreate,
  BudgetSettings,
  DashboardStats,
  FacultyStats,
  MonthlyStats,
  PaginatedResponse,
  AuditLogEntry,
  GroupHint,
  DataEntryContext,
  PaymentStatus,
  FacultyCreate,
} from '../types';

/**
 * Извлекает читаемое сообщение об ошибке из ответа API.
 * FastAPI при 422 возвращает detail как массив объектов {type, loc, msg, input, ctx},
 * а при других ошибках — как строку.
 */
export function extractErrorMessage(error: any, fallback = 'Произошла ошибка'): string {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: any) => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join('; ');
  }
  if (detail && typeof detail === 'object' && detail.msg) return detail.msg;
  return fallback;
}

// Create axios instance
const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies
});

// Flag to prevent infinite refresh loops
let isRefreshing = false;

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh for login/refresh endpoints or if already retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !isRefreshing
    ) {
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        isRefreshing = false;
        return api.request(originalRequest);
      } catch {
        isRefreshing = false;
        // Redirect to login only if not already there
        const publicPaths = ['/login', '/reset-password', '/forgot-password'];
        if (!publicPaths.includes(window.location.pathname)) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ============== Auth API ==============

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<TokenResponse> => {
    const { data } = await api.post('/auth/login', credentials);
    return data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data;
  },

  refresh: async (): Promise<TokenResponse> => {
    const { data } = await api.post('/auth/refresh');
    return data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  /** Запросить письмо со ссылкой восстановления. */
  requestPasswordReset: async (email: string): Promise<{ message: string }> => {
    const { data } = await api.post('/auth/password-reset/request', { email });
    return data;
  },

  /** Задать новый пароль по токену из письма. */
  confirmPasswordReset: async (token: string, newPassword: string): Promise<void> => {
    await api.post('/auth/password-reset/confirm', { token, new_password: newPassword });
  },
};

// ============== User Management API ==============

export const userApi = {
  getAll: async (): Promise<User[]> => {
    const { data } = await api.get('/auth/users');
    return data;
  },

  create: async (user: {
    username: string;
    email: string;
    password: string;
    full_name: string;
    role: string;
  }): Promise<User> => {
    const { data } = await api.post('/auth/users', user);
    return data;
  },

  update: async (id: number, user: Partial<User & { is_active: boolean }>): Promise<User> => {
    const { data } = await api.put(`/auth/users/${id}`, user);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/auth/users/${id}`);
  },

  /** Задать пользователю новый пароль и снять блокировку входа. */
  setPassword: async (id: number, newPassword: string): Promise<void> => {
    await api.post(`/auth/users/${id}/password`, { new_password: newPassword });
  },

  /** Снять блокировку входа, не меняя пароль. */
  unlock: async (id: number): Promise<void> => {
    await api.post(`/auth/users/${id}/unlock`);
  },
};

// ============== Faculty API ==============

export const facultyApi = {
  getAll: async (activeOnly = true): Promise<Faculty[]> => {
    const { data } = await api.get('/faculties', { params: { active_only: activeOnly } });
    return data;
  },

  create: async (faculty: FacultyCreate): Promise<Faculty> => {
    const { data } = await api.post('/faculties', faculty);
    return data;
  },

  update: async (id: number, faculty: Partial<Faculty>): Promise<Faculty> => {
    const { data } = await api.put(`/faculties/${id}`, faculty);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/faculties/${id}`);
  },
};

// ============== Payment Settings API ==============

export const paymentSettingsApi = {
  getAll: async (): Promise<PaymentSettings[]> => {
    const { data } = await api.get('/payment-settings');
    return data;
  },

  getCurrent: async (): Promise<PaymentSettings> => {
    const { data } = await api.get('/payment-settings/current');
    return data;
  },

  create: async (settings: PaymentSettingsCreate): Promise<PaymentSettings> => {
    const { data } = await api.post('/payment-settings', settings);
    return data;
  },

  update: async (id: number, settings: Partial<PaymentSettingsCreate>): Promise<PaymentSettings> => {
    const { data } = await api.put(`/payment-settings/${id}`, settings);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/payment-settings/${id}`);
  },
};

// ============== Budget Settings API ==============

export const budgetSettingsApi = {
  get: async (): Promise<BudgetSettings> => {
    const { data } = await api.get('/budget-settings');
    return data;
  },

  update: async (settings: Partial<BudgetSettings>): Promise<void> => {
    await api.put('/budget-settings', settings);
  },
};

// ============== Контекст ввода данных ==============

export const dataEntryApi = {
  /** Что подставится в новую запись из настроек системы. */
  getContext: async (): Promise<DataEntryContext> => {
    const { data } = await api.get('/data-entry-context');
    return data;
  },

  /** Уже заведённые группы — для подстановки кафедры и уровня. */
  getGroupHints: async (facultyId?: number): Promise<GroupHint[]> => {
    const { data } = await api.get('/group-hints', { params: { faculty_id: facultyId } });
    return data;
  },
};

// ============== Payer API ==============

export interface PayerFilters {
  page?: number;
  per_page?: number;
  faculty_id?: number;
  status?: PaymentStatus;
  search?: string;
  /** active — без архива (по умолчанию), archived — только архив, all — все */
  archive?: 'active' | 'archived' | 'all';
}

export const payerApi = {
  getAll: async (filters: PayerFilters = {}): Promise<PaginatedResponse<Payer>> => {
    const { data } = await api.get('/payers', { params: filters });
    return data;
  },

  getById: async (id: number): Promise<Payer> => {
    const { data } = await api.get(`/payers/${id}`);
    return data;
  },

  create: async (payer: PayerCreate): Promise<Payer> => {
    const { data } = await api.post('/payers', payer);
    return data;
  },

  update: async (id: number, payer: Partial<PayerCreate>): Promise<Payer> => {
    const { data } = await api.put(`/payers/${id}`, payer);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/payers/${id}`);
  },

  getDebtors: async (filters: PayerFilters = {}): Promise<PaginatedResponse<Payer>> => {
    const { data } = await api.get('/debtors', { params: filters });
    return data;
  },

  /** Полное удаление вместе с платежами. По умолчанию запись только скрывается. */
  hardDelete: async (id: number): Promise<void> => {
    await api.delete(`/payers/${id}`, { params: { hard: true } });
  },
};

// ============== Payment API ==============

export const paymentApi = {
  getByPayer: async (payerId: number): Promise<Payment[]> => {
    const { data } = await api.get(`/payers/${payerId}/payments`);
    return data;
  },

  create: async (payment: PaymentCreate): Promise<Payment> => {
    const { data } = await api.post('/payments', payment);
    return data;
  },

  update: async (id: number, payment: Partial<PaymentCreate>): Promise<Payment> => {
    const { data } = await api.put(`/payments/${id}`, payment);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/payments/${id}`);
  },
};

// ============== Stats API ==============

export const statsApi = {
  getDashboard: async (): Promise<DashboardStats> => {
    const { data } = await api.get('/stats/dashboard');
    return data;
  },

  getByFaculty: async (): Promise<FacultyStats[]> => {
    const { data } = await api.get('/stats/by-faculty');
    return data;
  },

  getMonthly: async (year?: number): Promise<MonthlyStats[]> => {
    const { data } = await api.get('/stats/monthly', { params: { year } });
    return data;
  },

  getAudit: async (limit = 100): Promise<AuditLogEntry[]> => {
    const { data } = await api.get('/stats/audit', { params: { limit } });
    return data;
  },
};

// ============== Export API ==============

export const exportApi = {
  exportPayersExcel: async (filters: PayerFilters = {}): Promise<void> => {
    const response = await api.get('/payers/export', {
      params: filters,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toLocaleDateString('ru-RU').replace(/\./g, '-');
    link.setAttribute('download', `profpay_${today}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default api;
