export interface User {
  id: string;
  fullName: string;
  lastPaymentAmount?: number;
  lastPaymentDate?: string;
  status: 'paid' | 'debt' | 'partial';
  contact: {
    telegram?: string;
    vk?: string;
  };
  paymentHistory: Payment[];
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface UserRole {
  isAdmin: boolean;
  canEdit: boolean;
}

export interface FilterState {
  search: string;
  status: 'all' | 'paid' | 'debt' | 'partial';
  dateFrom?: string;
  dateTo?: string;
  contactType: 'all' | 'telegram' | 'vk';
}