import { supabase, isSupabaseConfigured } from './supabase';
import { format, addMonths, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const isUUID = (id: any): boolean => {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

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
  { id: 'acc-3', name: 'Itaú', type: 'Checking', balance: 1450.00, currency: 'BRL', color: '#0284c7' },
  { id: 'acc-4', name: 'Dinheiro', type: 'Cash', balance: 350.00, currency: 'BRL', color: '#10b981' },
  { id: 'acc-5', name: 'XP Investimentos', type: 'Investment', balance: 25000.00, currency: 'BRL', color: '#000000' }
];

export const INITIAL_DEMO_CARDS: Card[] = [
  { id: 'card-1', account_id: 'acc-1', name: 'Nubank Ultravioleta', limit_amount: 8000.00, closing_day: 10, due_day: 17, brand: 'Mastercard' },
  { id: 'card-2', account_id: 'acc-2', name: 'XP Visa Infinite', limit_amount: 15000.00, closing_day: 5, due_day: 12, brand: 'Visa' }
];

// Helper to determine which invoice billing month a purchase falls into
export function getInvoiceBillingMonth(dateStr: string, closingDay: number, dueDay?: number): string {
  try {
    const parts = dateStr.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1; // 0-indexed
    const day = Number(parts[2].substring(0, 2));

    let billingDate = new Date(year, month, 15); // Use mid-month to avoid timezone jumps
    
    const parsedClosingDay = Number(closingDay);
    if (!isNaN(parsedClosingDay) && day > parsedClosingDay) {
      // Falls into next month's invoice
      billingDate = addMonths(billingDate, 1);
    }
    
    // If dueDay is less than closingDay, it means the invoice is paid in the month AFTER the closing month.
    // So the cash outflow (billing month) is shifted by 1 month.
    if (dueDay !== undefined) {
      const parsedDueDay = Number(dueDay);
      if (!isNaN(parsedDueDay) && !isNaN(parsedClosingDay) && parsedDueDay < parsedClosingDay) {
        billingDate = addMonths(billingDate, 1);
      }
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
    if (account.id && isUUID(account.id)) {
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
  if (!isSupabaseConfigured || !isUUID(id)) {
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
    const { data: { user } } = await supabase.auth.getUser();
    
    let finalAccountId = card.account_id;
    if (!isUUID(finalAccountId)) {
      const dbAccounts = await getAccounts();
      const validAcc = dbAccounts.find(a => isUUID(a.id));
      finalAccountId = validAcc ? validAcc.id : '';
    }

    const payload: any = {
      account_id: finalAccountId || null,
      name: card.name,
      limit_amount: card.limit_amount,
      closing_day: card.closing_day,
      due_day: card.due_day,
      brand: card.brand,
      user_id: user?.id
    };

    let result;
    const hasValidCardId = card.id && isUUID(card.id);
    try {
      if (hasValidCardId) {
        const { data, error } = await supabase
          .from('cards')
          .update(payload)
          .eq('id', card.id!)
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
    } catch (insertErr: any) {
      // If user_id column doesn't exist in cards table schema, retry without it
      if (insertErr && (insertErr.code === '42703' || String(insertErr.message).includes('user_id'))) {
        console.warn('Retrying card save without user_id column...');
        const { user_id, ...payloadWithoutUserId } = payload;
        if (hasValidCardId) {
          const { data, error } = await supabase
            .from('cards')
            .update(payloadWithoutUserId)
            .eq('id', card.id!)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          const { data, error } = await supabase
            .from('cards')
            .insert(payloadWithoutUserId)
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
      } else {
        throw insertErr;
      }
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
  if (!isSupabaseConfigured || !isUUID(id)) {
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
  const cardTxs = transactions.filter(t => t.card_id === card.id);
  const now = new Date();
  const currentMonthValue = getInvoiceBillingMonth(format(now, 'yyyy-MM-dd'), card.closing_day, card.due_day);
  const nextMonthValue = getInvoiceBillingMonth(format(addMonths(now, 1), 'yyyy-MM-dd'), card.closing_day, card.due_day);

  let currentBill = 0;
  let nextBill = 0;
  let totalOutstanding = 0;
  const byMonth: Record<string, number> = {};

  cardTxs.forEach(tx => {
    const isIncome = tx.type === 'income';
    const amountVal = Math.abs(Number(tx.amount || 0));
    // Income (payments/credits) reduces the bill, expense adds to it
    const finalAmount = isIncome ? -amountVal : amountVal;

    const billingMonth = getInvoiceBillingMonth(tx.date, card.closing_day, card.due_day);

    byMonth[billingMonth] = (byMonth[billingMonth] || 0) + finalAmount;
    totalOutstanding += finalAmount;

    if (billingMonth === currentMonthValue) {
      currentBill += finalAmount;
    } else if (billingMonth === nextMonthValue) {
      nextBill += finalAmount;
    }
  });

  const finalCurrentBill = Math.max(0, currentBill);
  const finalNextBill = Math.max(0, nextBill);
  const finalTotalOutstanding = Math.max(0, totalOutstanding);

  const limitUtilization = card.limit_amount > 0 ? (finalCurrentBill / card.limit_amount) * 100 : 0;
  const isWarning = limitUtilization >= 80 && limitUtilization < 100;
  const isCritical = limitUtilization >= 100;

  return {
    currentBill: finalCurrentBill,
    nextBill: finalNextBill,
    totalOutstanding: finalTotalOutstanding,
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

      // 2. Record checks and card transactions of payment
      const localSaved = localStorage.getItem('finna_transactions');
      const txs = localSaved ? JSON.parse(localSaved) : [];
      
      const newTxCheck = {
        id: 'tx-' + Math.random().toString(36).substring(2, 9),
        description: description,
        amount: -amount,
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'expense' as const,
        category: 'Outros',
        emotion: 'Aliviado',
        source: sourceAccount ? sourceAccount.name : 'Outro',
        status: 'completed',
        account_id: sourceAccountId !== 'manual' ? sourceAccountId : null
      };

      const newTxCard = {
        id: 'tx-' + Math.random().toString(36).substring(2, 9),
        description: `Crédito de Pagamento - ${card.name}`,
        amount: amount, // Positive amount
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'income' as const,
        category: 'Outros',
        emotion: 'Aliviado',
        source: card.name,
        status: 'completed',
        card_id: card.id,
        account_id: sourceAccountId !== 'manual' ? sourceAccountId : null
      };

      localStorage.setItem('finna_transactions', JSON.stringify([newTxCheck, newTxCard, ...txs]));
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

    // Add settlement transactions: both debit from bank account and credit to credit card
    const { error: txError } = await supabase.from('transactions').insert([
      {
        user_id: user.id,
        description: description,
        amount: -amount,
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'expense',
        category: 'Outros',
        source: sourceAccount ? sourceAccount.name : 'Manual',
        status: 'completed',
        account_id: isUUID(sourceAccountId) ? sourceAccountId : null
      },
      {
        user_id: user.id,
        description: `Crédito de Pagamento - ${card.name}`,
        amount: amount, // Positive
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'income',
        category: 'Outros',
        source: card.name,
        status: 'completed',
        card_id: card.id,
        account_id: isUUID(sourceAccountId) ? sourceAccountId : null
      }
    ]);

    if (txError) throw txError;

    // Deduct checking account balance in database
    if (sourceAccount && isUUID(sourceAccountId)) {
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

export function expandInstallmentTransactions(transactions: any[], isSupabaseConfig: boolean = false): any[] {
  const result: any[] = [];
  
  for (const tx of transactions) {
    result.push(tx); // Insere a parcela atual encontrada no extrato (ex: 1/3)
    
    let installmentsStr = tx.installments;
    if (!installmentsStr && tx.description) {
      // Regex para captação de formato (1/5) ou "1/5" ou "1 de 5" na descrição
      const match = tx.description.match(/[(]?(\d+)\s*\/\s*(\d+)[)]?/) || tx.description.match(/[(]?(\d+)\s+de\s+(\d+)[)]?/i);
      if (match) {
        installmentsStr = `${match[1]}/${match[2]}`;
      }
    }
    
    if (installmentsStr && typeof installmentsStr === 'string' && installmentsStr.includes('/')) {
      const parts = installmentsStr.split('/');
      const currentIdx = parseInt(parts[0], 10);
      const totalIdx = parseInt(parts[1], 10);
      
      if (!isNaN(currentIdx) && !isNaN(totalIdx) && currentIdx > 0 && totalIdx > currentIdx) {
        const baseDesc = tx.description.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/, '')
                                       .replace(/\s*\d+\s*\/\s*\d+\s*$/, '')
                                       .replace(/\s*\(\s*\d+\s+de\s+\d+\s*\)\s*$/, '')
                                       .replace(/\s*\d+\s+de\s+\d+\s*$/, '')
                                       .trim();
        
        // Gera e valida as faturas subsequentes criando as parcelas restantes dele
        for (let i = currentIdx + 1; i <= totalIdx; i++) {
          const monthsToAdd = i - currentIdx;
          let nextDateStr = tx.date;
          
          try {
            const dateObj = new Date(tx.date + 'T12:00:00');
            if (!isNaN(dateObj.getTime())) {
              const nextDate = addMonths(dateObj, monthsToAdd);
              nextDateStr = format(nextDate, 'yyyy-MM-dd');
            }
          } catch (e) {
            console.error('Erro na data de parcela subsequente:', e);
          }
          
          const nextTx = {
            ...tx,
            description: `${baseDesc} (${i}/${totalIdx})`,
            date: nextDateStr,
            installments: `${i}/${totalIdx}`
          };
          
          if (!isSupabaseConfig) {
            nextTx.id = 'tx-' + Math.random().toString(36).substring(2, 9);
          } else {
            delete nextTx.id;
          }
          
          result.push(nextTx);
        }
      }
    }
  }
  
  return result;
}

export function isDuplicateTransaction(newTx: any, existingTx: any, cardId?: string | null): boolean {
  // If cardId is specified, check card matching
  if (cardId) {
    if (existingTx.card_id !== cardId) return false;
  } else if (newTx.card_id) {
    if (existingTx.card_id !== newTx.card_id) return false;
  } else if (newTx.account_id) {
    if (existingTx.account_id !== newTx.account_id) return false;
  }

  // 1. Amount matching (absolute floats, close under 0.02 delta)
  const newAmt = Math.abs(Number(newTx.amount || 0));
  const extAmt = Math.abs(Number(existingTx.amount || 0));
  if (Math.abs(newAmt - extAmt) > 0.02) {
    return false;
  }

  // 2. Installment checks & extraction of base description
  const extractParts = (desc: string) => {
    if (!desc) return { base: '', installment: null };
    const match = desc.match(/\s*[(]?(\d+)\s*\/\s*(\d+)[)]?\s*$/) || desc.match(/\s*[(]?(\d+)\s+de\s+(\d+)[)]?\s*$/i);
    if (match) {
      return {
        base: desc.replace(match[0], '').replace(/\s+/g, ' ').trim().toLowerCase(),
        installment: `${match[1]}/${match[2]}`
      };
    }
    return {
      base: desc.replace(/\s+/g, ' ').trim().toLowerCase(),
      installment: null
    };
  };

  const newParts = extractParts(newTx.description);
  const extParts = extractParts(existingTx.description);

  // If one of them has an installment coordinate, we must match base descriptions AND the coordinates
  if (newParts.installment || extParts.installment) {
    const basesMatch = newParts.base === extParts.base || 
                       newParts.base.includes(extParts.base) || 
                       extParts.base.includes(newParts.base);
    
    if (basesMatch && newParts.installment === extParts.installment) {
      return true;
    }
    return false;
  }

  // 3. Flat transactions description sanitization & mapping
  const sanitize = (term: string) => term.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const newClean = sanitize(newTx.description);
  const extClean = sanitize(existingTx.description);

  const descMatch = newClean === extClean || 
                    newClean.includes(extClean) || 
                    extClean.includes(newClean);

  if (!descMatch) return false;

  // 4. Date Proximity Check within 4 days (to tolerate weekends bank delays)
  if (newTx.date && existingTx.date) {
    try {
      const d1 = new Date(newTx.date + 'T12:00:00');
      const d2 = new Date(existingTx.date + 'T12:00:00');
      const diffMs = Math.abs(d1.getTime() - d2.getTime());
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays <= 4) {
        return true;
      }
    } catch {
      return newTx.date === existingTx.date;
    }
  }

  return false;
}

export function filterDuplicateTransactions(
  newTxs: any[],
  existingTxs: any[],
  cardId?: string | null
): {
  finalTransactions: any[];
  skippedCount: number;
  skippedDescriptions: string[];
} {
  const finalTransactions: any[] = [];
  const skippedDescriptions: string[] = [];
  let skippedCount = 0;

  for (const t of newTxs) {
    // See if it matches any transaction inside existingTxs
    const duplicate = existingTxs.some(ext => isDuplicateTransaction(t, ext, cardId));
    if (duplicate) {
      skippedCount++;
      const fmtDesc = t.description;
      if (!skippedDescriptions.includes(fmtDesc)) {
        skippedDescriptions.push(fmtDesc);
      }
    } else {
      finalTransactions.push(t);
    }
  }

  return {
    finalTransactions,
    skippedCount,
    skippedDescriptions
  };
}

