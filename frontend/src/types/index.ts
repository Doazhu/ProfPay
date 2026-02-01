// User types
export type UserRole = 'admin' | 'operator' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

// Payment status
export type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'exempt';

// Faculty
export interface Faculty {
  id: number;
  name: string;
  short_name: string | null;
  is_active: boolean;
  created_at: string;
}

// Student Group
export interface StudentGroup {
  id: number;
  name: string;
  faculty_id: number;
  course: number;
  is_active: boolean;
  created_at: string;
  faculty?: Faculty;
}

// Payer
export interface Payer {
  id: number;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  faculty_id: number;
  group_id: number | null;
  student_id: string | null;
  status: PaymentStatus;
  membership_start: string | null;
  membership_end: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  total_paid: number;
  faculty?: Faculty;
  group?: StudentGroup;
  payments?: Payment[];
}

// Payment
export interface Payment {
  id: number;
  payer_id: number;
  amount: number;
  payment_date: string;
  period_start: string;
  period_end: string;
  receipt_number: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

// Statistics
export interface DashboardStats {
  total_payers: number;
  active_payers: number;
  total_debtors: number;
  total_paid_amount: number;
  paid_count: number;
  partial_count: number;
  unpaid_count: number;
  exempt_count: number;
}

export interface FacultyStats {
  faculty_id: number;
  faculty_name: string;
  total_payers: number;
  paid_count: number;
  unpaid_count: number;
  total_amount: number;
}

export interface MonthlyStats {
  month: string;
  payments_count: number;
  total_amount: number;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

// Auth
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

// Create/Update DTOs
export interface PayerCreate {
  last_name: string;
  first_name: string;
  middle_name?: string;
  email?: string;
  phone?: string;
  faculty_id: number;
  group_id?: number;
  student_id?: string;
  status?: PaymentStatus;
  membership_start?: string;
  membership_end?: string;
  notes?: string;
}

export interface PaymentCreate {
  payer_id: number;
  amount: number;
  payment_date: string;
  period_start: string;
  period_end: string;
  receipt_number?: string;
  payment_method?: string;
  notes?: string;
}
