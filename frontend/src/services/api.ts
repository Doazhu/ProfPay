import axios from 'axios';
import type {
  User,
  LoginCredentials,
  TokenResponse,
  Faculty,
  StudentGroup,
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
  PaymentStatus,
  GroupCreate,
  FacultyCreate,
} from '../types';

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
        if (window.location.pathname !== '/login') {
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

// ============== Group API ==============

export const groupApi = {
  getAll: async (facultyId?: number, activeOnly = true): Promise<StudentGroup[]> => {
    const { data } = await api.get('/groups', {
      params: { faculty_id: facultyId, active_only: activeOnly },
    });
    return data;
  },

  create: async (group: GroupCreate): Promise<StudentGroup> => {
    const { data } = await api.post('/groups', group);
    return data;
  },

  update: async (id: number, group: Partial<StudentGroup>): Promise<StudentGroup> => {
    const { data } = await api.put(`/groups/${id}`, group);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/groups/${id}`);
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

// ============== Payer API ==============

export interface PayerFilters {
  page?: number;
  per_page?: number;
  faculty_id?: number;
  group_id?: number;
  status?: PaymentStatus;
  search?: string;
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
