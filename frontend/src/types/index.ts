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
  is_locked: boolean;      // вход заблокирован после серии неудачных попыток
  totp_enabled: boolean;   // включён второй фактор
}

// Payment status (2 main: paid / unpaid; partial & exempt kept for backend compatibility)
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'exempt';

// Уровень образования — от него зависит, сколько курсов до выпуска
export type EducationLevel = 'bachelor' | 'specialist' | 'master';

export const EDUCATION_LEVELS: { value: EducationLevel; label: string; years: number }[] = [
  { value: 'bachelor', label: 'Бакалавриат', years: 4 },
  { value: 'specialist', label: 'Специалитет', years: 5 },
  { value: 'master', label: 'Магистратура', years: 2 },
];

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  bachelor: 'Бакалавриат',
  specialist: 'Специалитет',
  master: 'Магистратура',
};

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
  group_name: string | null;   // как хранится в БД, напр. "1-мд-35"
  group_code: string | null;   // с актуальным курсом, напр. "3-мд-35" — показывать надо это
  admission_year: number | null;
  education_level: EducationLevel;
  course: number | null;       // вычисляется на бэкенде из года поступления
  is_archived: boolean;        // срок обучения вышел
  department: string | null;   // Кафедра abbreviation e.g. "ЦИАТ", optional
  status: PaymentStatus;
  membership_start: string | null;
  membership_end: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  total_paid: number;
  decryption_failed: boolean;  // часть полей не открылась текущим ключом
  faculty?: Faculty;
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
  receipt_number: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

// Statistics
export interface DashboardStats {
  total_payers: number;
  active_payers: number;
  archived_payers: number;
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
  /** Не заплатившие вовсе плюс заплатившие частично — как в сводке наверху. */
  debtors_count: number;
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
  /** Код из приложения-аутентификатора либо резервный код «abcd-efgh». */
  totp_code?: string;
}

// Второй фактор
export interface TotpSetup {
  secret: string;
  qr_svg: string;
  account: string;
}

export interface TotpStatus {
  enabled: boolean;
  recovery_codes_left: number;
  /** Второй фактор обязателен всем по настройке системы. */
  required: boolean;
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
  group_name?: string;    // Free-form group code e.g. "1-мд-35"
  admission_year?: number;
  education_level?: EducationLevel;
  department?: string;    // Кафедра e.g. "ЦИАТ", optional
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

export interface FacultyCreate {
  name: string;
  short_name?: string;
}

// Журнал изменений
export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  summary: string | null;
  ip_address: string | null;
  created_at: string;
}

// Подсказка по ранее заведённым группам — из неё подставляется кафедра
export interface GroupHint {
  group_name: string;
  faculty_id: number | null;
  department: string | null;
  education_level: EducationLevel;
  count: number;
  latest_admission_year: number | null;
}

// Что подставится в новую запись из настроек системы
export interface DataEntryContext {
  academic_year: string;
  academic_year_start: number;
  fall_amount: number | null;
  spring_amount: number | null;
  year_total: number | null;
  currency: string;
  has_payment_settings: boolean;
  default_budget_percent: string;
  default_stipend_amount: string;
  faculties_count: number;
}
