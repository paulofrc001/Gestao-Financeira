import { supabase, isSupabaseConfigured } from './supabase';
import { format, addMonths, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type AccountType = 'Checking' | 'Savings' | 'Investment' | 'Cash';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color?: string;
  user_id?: string;
  family_id?: string;
}

export interface Card {
  id: string;
  account_id: string; // Associated account for automatic debit / payment
  name: string;
  limit_amount: number;
  closing_day: number;
  due_day: number;
  brand?: string;
}

// Default Seed Data for Demo Mode
export const INITIAL_DEMO_ACCOUNTS: Account[] = [
  { id: 'acc-1', name: 'Nubank Principal', type: 'Checking', balance: 3450.00, currency: 'BRL', color: '#820ad1' },
  { id: 'acc-2', name: 'Itaú Recebimento', type: 'Checking', balance: 8520.40, currency: 'BRL', color: '#ec7000' },
  { id: 'acc-3', name: 'XP Investimentos', type: 'Investment', balance: 25000.00, currency: 'BRL', color: '#000000' },
  { id: 'acc-4', name: 'Almoço & Dinheiro', type: 'Cash', balance: 350.00, currency: 'BRL', color: '#10b981' }
];

export const INITIAL_DEMO_CARDS: Card[] = [
  { id: 'card-1', account_id: 'acc-1', name: 'Nubank Ultravioleta', limit_amount: 8000.00, closing_day: 10, due_day: 17, brand: 'Mastercard' },
  { id: 'card-2', account_id: 'acc-2', name: 'XP Visa Infinite', limit_amount: 15000.00, closing_day: 5, due_day: 12, brand: 'Visa' }
];

// Helper to determine which invoice billing month a purchase falls into
export function getInvoiceBillingMonth(dateStr: string, closingDay: number): string {
  try {
    const parts = dateStr.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1; // 0-indexed
    const day = Number(parts[2].substring(0, 2));

    let billingDate = new Date(year, month, 15); // Use mid-month to avoid timezone jumps
    
    if (day > closingDay) {
      // Falls into next month's invoice
      billingDate = addMonths(billingDate, 1);
    }
    
    return format(billingDate, 'yyyy-MM');
  } catch (err) {
    console.error('Error calculating billing month', err);
    return dateStr.substring(0, 7); // Fallback to current year-month
  }
}

// Format "YYYY-MM" to readable "Mês/Ano" like "Maio de 2026"
export function formatBillingMonthLabel(yearMonth: string): string {
  try {
    const [year, month] = yearMonth.split('-');
    const date = new Date(Number(year), Number(month) - 1, 15);
    const label = format(date, 'MMMM yyyy', { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return yearMonth;
  }
}

// Generate the list of next N months' invoices for prediction
export function getUpcomingInvoicesList(count: number = 6): { value: string; label: string }[] {
  const result = [];
  const start = new Date();
  for (let i = 0; i < count; i++) {
    const d = addMonths(start, i);
    const value = format(d, 'yyyy-MM');
    result.push({
      value,
      label: formatBillingMonthLabel(value)
    });
  }
  return result;
}

// Load Accounts from LocalStorage or Supabase
export async function getAccounts(): Promise<Account[]> {
  if (!isSupabaseConfigured) {
    const saved = localStorage.getItem('finna_accounts');
    if (saved) {
      return JSON.parse(saved);
    } else {
      localStorage.setItem('finna_accounts', JSON.stringify(INITIAL_DEMO_ACCOUNTS));
      return INITIAL_DEMO_ACCOUNTS;
    }
  }

  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      type: item.type as AccountType,
      balance: Number(item.balance),
      currency: item.currency || 'BRL',
      color: item.color,
      user_id: item.user_id,
      family_id: item.family_id
    }));
  } catch (err) {
    console.error('Error fetching accounts from Supabase:', err);
    return INITIAL_DEMO_ACCOUNTS;
  }
}

// Save or Update Account
export async function saveAccount(account: Omit<Account, 'id'> & { id?: string }): Promise<Account> {
  if (!isSupabaseConfigured) {
    const accounts = await getAccounts();
    let updatedAccount: Account;
    
    if (account.id) {
      updatedAccount = { ...account, id: account.id } as Account;
      const index = accounts.findIndex(a => a.id === account.id);
      if (index !== -1) {
        accounts[index] = updatedAccount;
      }
    } else {
      updatedAccount = {
        ...account,
        id: 'acc-' + Math.random().toString(36).substring(2, 9)
      } as Account;
      accounts.push(updatedAccount);
    }
    
    localStorage.setItem('finna_accounts', JSON.stringify(accounts));
    return updatedAccount;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      name: account.name,
      type: account.type,
      balance: account.balance,
      currency: account.currency,
      color: account.color,
      user_id: user?.id,
    };

    let result;
    if (account.id) {
      const { data, error } = await supabase
        .from('accounts')
        .update(payload)
        .eq('id', account.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('accounts')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return {
      id: result.id,
      name: result.name,
      type: result.type as AccountType,
      balance: Number(result.balance),
      currency: result.currency,
      color: result.color
    };
  } catch (err: any) {
    console.error('Error saving account to Supabase:', err);
    throw err;
  }
}

// Delete Account
export async function deleteAccount(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const accounts = await getAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    localStorage.setItem('finna_accounts', JSON.stringify(filtered));
    return;
  }

  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) throw error;
}

// Load Cards from LocalStorage or Supabase
export async function getCards(): Promise<Card[]> {
  if (!isSupabaseConfigured) {
    const saved = localStorage.getItem('finna_cards');
    if (saved) {
      return JSON.parse(saved);
    } else {
      localStorage.setItem('finna_cards', JSON.stringify(INITIAL_DEMO_CARDS));
      return INITIAL_DEMO_CARDS;
    }
  }

  try {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return (data || []).map(item => ({
      id: item.id,
      account_id: item.account_id,
      name: item.name,
      limit_amount: Number(item.limit_amount),
      closing_day: Number(item.closing_day),
      due_day: Number(item.due_day),
      brand: item.brand
    }));
  } catch (err) {
    console.error('Error fetching cards from Supabase:', err);
    return INITIAL_DEMO_CARDS;
  }
}

// Save or Update Credit Card
export async function saveCard(card: Omit<Card, 'id'> & { id?: string }): Promise<Card> {
  if (!isSupabaseConfigured) {
    const cards = await getCards();
    let updatedCard: Card;
    
    if (card.id) {
      updatedCard = { ...card, id: card.id } as Card;
      const index = cards.findIndex(c => c.id === card.id);
      if (index !== -1) {
        cards[index] = updatedCard;
      }
    } else {
      updatedCard = {
        ...card,
        id: 'card-' + Math.random().toString(36).substring(2, 9)
      } as Card;
      cards.push(updatedCard);
    }
    
    localStorage.setItem('finna_cards', JSON.stringify(cards));
    return updatedCard;
  }

  try {
    const payload = {
      account_id: card.account_id,
      name: card.name,
      limit_amount: card.limit_amount,
      closing_day: card.closing_day,
      due_day: card.due_day,
      brand: card.brand
    };

    let result;
    if (card.id) {
      const { data, error } = await supabase
        .from('cards')
        .update(payload)
        .eq('id', card.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('cards')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return {
      id: result.id,
      account_id: result.account_id,
      name: result.name,
      limit_amount: Number(result.limit_amount),
      closing_day: Number(result.closing_day),
      due_day: Number(result.due_day),
      brand: result.brand
    };
  } catch (err: any) {
    console.error('Error saving card to Supabase:', err);
    throw err;
  }
}

// Delete Card
export async function deleteCard(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const cards = await getCards();
    const filtered = cards.filter(c => c.id !== id);
    localStorage.setItem('finna_cards', JSON.stringify(filtered));
    return;
  }

  const { error } = await supabase.from('cards').delete().eq('id', id);
  if (error) throw error;
}

// Calculate credit card current bill, predicting future months' bills, and check limits
export function calculateCardMetrics(
  card: Card,
  transactions: any[]
): {
  currentBill: number; // For active cycle
  nextBill: number;    // Next period
  totalOutstanding: number; // All upcoming transactions charges combined
  byMonth: Record<string, number>; // YYYY-MM -> amount
  limitUtilization: number; // percentage
  isWarning: boolean;      // >80% utilization
  isCritical: boolean;     // >100% utilization
} {
  const cardTxs = transactions.filter(t => t.card_id === card.id && t.type === 'expense');
  const now = new Date();
  const currentMonthValue = getInvoiceBillingMonth(format(now, 'yyyy-MM-dd'), card.closing_day);
  const nextMonthValue = getInvoiceBillingMonth(format(addMonths(now, 1), 'yyyy-MM-dd'), card.closing_day);

  let currentBill = 0;
  let nextBill = 0;
  let totalOutstanding = 0;
  const byMonth: Record<string, number> = {};

  cardTxs.forEach(tx => {
    const amount = Math.abs(Number(tx.amount || 0));
    const billingMonth = getInvoiceBillingMonth(tx.date, card.closing_day);

    byMonth[billingMonth] = (byMonth[billingMonth] || 0) + amount;
    totalOutstanding += amount;

    if (billingMonth === currentMonthValue) {
      currentBill += amount;
    } else if (billingMonth === nextMonthValue) {
      nextBill += amount;
    }
  });

  const limitUtilization = card.limit_amount > 0 ? (currentBill / card.limit_amount) * 100 : 0;
  const isWarning = limitUtilization >= 80 && limitUtilization < 100;
  const isCritical = limitUtilization >= 100;

  return {
    currentBill,
    nextBill,
    totalOutstanding,
    byMonth,
    limitUtilization,
    isWarning,
    isCritical
  };
}

// Pay Invoice: Register transaction that pays credit card
export async function payCreditCardInvoice(
  card: Card,
  amount: number,
  sourceAccountId: string
): Promise<void> {
  const accounts = await getAccounts();
  const sourceAccount = accounts.find(a => a.id === sourceAccountId);
  if (!sourceAccount && sourceAccountId !== 'manual') {
    throw new Error('Conta bancária de origem não encontrada');
  }

  const invoiceMonth = format(new Date(), 'MMMM/yyyy', { locale: ptBR });
  const description = `Pagam. Fatura ${card.name} - ${invoiceMonth}`;

  // Log payment of invoice as a regular bank transfer expense or credit card settlement
  if (!isSupabaseConfigured) {
    // Local / Demo Mode
    try {
      // 1. Subtract from Bank account balance
      if (sourceAccount) {
        sourceAccount.balance -= amount;
        const index = accounts.findIndex(a => a.id === sourceAccountId);
        accounts[index] = sourceAccount;
        localStorage.setItem('finna_accounts', JSON.stringify(accounts));
      }

      // 2. We can record a payment transaction that has card_id but is positive (income/credit) of card_id, 
      // or simply of checking account type
      const localSaved = localStorage.getItem('finna_transactions');
      const txs = localSaved ? JSON.parse(localSaved) : [];
      
      const newTxCheck = {
        id: 'tx-' + Math.random().toString(36).substring(2, 9),
        description: description,
        amount: -amount,
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'expense' as const,
        category: 'moradia', // fellback category for invoice
        emotion: 'Aliviado',
        source: sourceAccount ? sourceAccount.name : 'Outro',
        status: 'completed',
        account_id: sourceAccountId
      };

      // Since the bill is paid, we can optionally tag existing card transactions as "settled" or similar,
      // but standard is to record the debit transaction from checking account.
      localStorage.setItem('finna_transactions', JSON.stringify([newTxCheck, ...txs]));
    } catch (err: any) {
      console.error(err);
      throw err;
    }
    return;
  }

  // Supabase Implementation
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Add settlement transaction
    const { error: txError } = await supabase.from('transactions').insert({
      user_id: user.id,
      description: description,
      amount: -amount,
      date: format(new Date(), 'yyyy-MM-dd'),
      type: 'expense',
      category: 'Outros',
      source: sourceAccount ? sourceAccount.name : 'Manual',
      status: 'completed',
      account_id: sourceAccountId
    });

    if (txError) throw txError;

    // Deduct checking account balance in database
    if (sourceAccount) {
      const { error: accError } = await supabase
        .from('accounts')
        .update({ balance: sourceAccount.balance - amount })
        .eq('id', sourceAccountId);
      if (accError) throw accError;
    }

  } catch (err: any) {
    console.error(err);
    throw err;
  }
}
