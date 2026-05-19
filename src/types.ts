export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'checking' | 'savings' | 'investment' | 'credit';

export interface Family {
  id: string;
  name: string;
  created_at: string;
  creator_id: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: 'admin' | 'partner' | 'member';
  joined_at: string;
}

export interface Account {
  id: string;
  family_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color?: string;
}

export interface Card {
  id: string;
  account_id: string;
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  brand?: string;
}

export interface Category {
  id: string;
  family_id: string;
  name: string;
  icon?: string;
  color?: string;
  type: 'income' | 'expense';
  is_preset: boolean;
}

export interface Transaction {
  id: string;
  family_id: string;
  account_id: string;
  card_id?: string;
  category_id?: string;
  category: string;
  user_id: string;
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
  status: 'pending' | 'completed';
  is_recurring: boolean;
  recurrence_period?: string;
  installments?: string;
  source?: string;
  
  // Emotional Data
  emotion?: string;
  is_impulse?: boolean;
  necessity_level?: number;
  regret_expected?: number;
  notes?: string;
  
  created_at: string;
}

export interface Goal {
  id: string;
  family_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  category?: string;
  color?: string;
}

export interface AIInsight {
  id: string;
  family_id: string;
  type: 'alert' | 'suggestion' | 'pattern';
  title: string;
  content: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type?: string;
  is_read: boolean;
  created_at: string;
}
