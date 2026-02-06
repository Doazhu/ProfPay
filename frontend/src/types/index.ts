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

// Semester type
export type SemesterType = 'fall' | 'spring';

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
  faculty_id: number;  // Required now
  course: number | null;
  is_active: boolean;
  created_at: string;
  faculty: Faculty;  // Always present
}

// Payment Settings
export interface PaymentSettings {
  id: number;
  academic_year: string;
  currency: string;
  fall_amount: number;
  spring_amount: number;
  total_year_amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Payer
export interface BudgetSettings {
  default_budget_percent: string;
  default_stipend_amount: string;
}

export interface Payer {
  id: number;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  date_of_birth: string | null;
  is_budget: boolean;
  stipend_amount: number | null;
  budget_percent: number | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  vk: string | null;
  faculty_id: number | null;
  group_id: number | null;
  course: number | null;
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
  academic_year: string | null;
  semester: SemesterType | null;
  period_start: string | null;
  period_end: string | null;
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
  date_of_birth?: string;
  is_budget?: boolean;
  stipend_amount?: number;
  budget_percent?: number;
  email?: string;
  phone?: string;
  telegram?: string;
  vk?: string;
  faculty_id?: number;
  group_id?: number;
  course?: number;
  status?: PaymentStatus;
  membership_start?: string;
  membership_end?: string;
  notes?: string;
}

export interface PaymentCreate {
  payer_id: number;
  amount: number;
  payment_date: string;
  academic_year?: string;
  semester?: SemesterType;
  period_start?: string;
  period_end?: string;
  receipt_number?: string;
  payment_method?: string;
  notes?: string;
}

export interface PaymentSettingsCreate {
  academic_year: string;
  currency?: string;
  fall_amount: number;
  spring_amount: number;
}

export interface GroupCreate {
  name: string;
  faculty_id: number;  // Required
  course?: number;
}

export interface FacultyCreate {
  name: string;
  short_name?: string;
}
