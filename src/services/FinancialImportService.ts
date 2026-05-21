import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { format, addMonths, subMonths, parseISO, isValid } from 'date-fns';
import { Purchase, PurchaseInstallment } from '../types';

export interface CleanLine {
  raw: string;
  date: string; // YYYY-MM-DD string
  description: string;
  amount: number;
  isInstallment: boolean;
  installmentCurrent: number;
  installmentTotal: number;
}

export class FinancialImportService {
  
  /**
    * =========================================================================
    * 1. CAMADA: PARSER BRUTO
    * =========================================================================
    * Extracts lines, cleans noise, normalizes amounts & dates, captures regex-based installments.
    */
  public static parseRawText(text: string): CleanLine[] {
    if (!text) return [];
    
    const lines = text.split(/\r?\n/);
    const cleanedLines: CleanLine[] = [];
    const currentYear = new Date().getFullYear();

    // Regex elements
    const dateRegexBRL = /(\d{1,2})[\/\-s](\d{1,2})([\/\-s](\d{2,4}))?/; // DD/MM/YYYY or DD/MM
    const dateRegexISO = /(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/; // YYYY-MM-DD
    const installmentRegex = /(\d{1,2})\s*[\/xXhH]\s*(\d{1,2})/i; // e.g., 03/10 or 3x10
    const installmentDeRegex = /(\d{1,2})\s+de\s+(\d{1,2})/i;    // e.g., 3 de 10

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) continue;

      // Skip non-transaction lines typical to statements
      const lower = trimmed.toLowerCase();
      if (
        lower.includes('saldo anterior') || 
        lower.includes('saldo devedor') || 
        lower.includes('limite total') || 
        lower.includes('limite dispon') || 
        lower.includes('fatura fechada') || 
        lower.includes('pagamento efetuado') || 
        lower.includes('extrato de conta') ||
        lower.includes('demonstrativo') ||
        lower.includes('encargos') ||
        lower.includes('multa') ||
        lower.includes('iof')
      ) {
        continue;
      }

      // Pre-extract amount
      // Capture standard currency formats such as (R$ 1.250,90 or -1.250,90 or 239.99)
      const amountCleanedText = trimmed
        .replace(/r\$\s*/i, '')
        .replace(/\s/g, '');
      
      // Look for credit card numbers and monetary numbers
      const moneyMatches = amountCleanedText.match(/-?(\d{1,3}(\.\d{3})*,\d{2})|-?(\d+[\.,]\d{2})/g);
      let parsedAmount = 0;
      if (moneyMatches && moneyMatches.length > 0) {
        // Grab the last match on the line, which is usually the transaction value
        const lastMoney = moneyMatches[moneyMatches.length - 1];
        let normalized = lastMoney;
        if (normalized.includes(',') && normalized.includes('.')) {
          // Format 1.250,90 -> 1250.90
          normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else if (normalized.includes(',')) {
          // Format 239,99 -> 239.99
          normalized = normalized.replace(',', '.');
        }
        parsedAmount = parseFloat(normalized);
        if (isNaN(parsedAmount)) parsedAmount = 0;
      }

      // Pre-extract date
      let parsedDateStr = format(new Date(), 'yyyy-MM-dd');
      let dateMatch = trimmed.match(dateRegexISO);
      
      if (dateMatch) {
        parsedDateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      } else {
        dateMatch = trimmed.match(dateRegexBRL);
        if (dateMatch) {
          const day = dateMatch[1].padStart(2, '0');
          const month = dateMatch[2].padStart(2, '0');
          let year = currentYear;
          if (dateMatch[4]) {
            year = dateMatch[4].length === 2 ? 2000 + parseInt(dateMatch[4], 10) : parseInt(dateMatch[4], 10);
          }
          parsedDateStr = `${year}-${month}-${day}`;
        }
      }

      // Pre-extract installment pattern by checking a copy of the line with the date removed
      let isInstallment = false;
      let installmentCurrent = 0;
      let installmentTotal = 0;

      let stringForInstallment = trimmed;
      if (dateMatch) {
        stringForInstallment = stringForInstallment.replace(dateMatch[0], '');
      }

      // Check parenthesized patterns first (e.g. (02/10) or [02/10])
      const parenMatch = stringForInstallment.match(/\((\d{1,2})\s*[\/xXhH\-de]+\s*(\d{1,2})\)/) ||
                          stringForInstallment.match(/\[(\d{1,2})\s*[\/xXhH\-de]+\s*(\d{1,2})\]/);

      let instMatch = null;
      if (parenMatch) {
        isInstallment = true;
        installmentCurrent = parseInt(parenMatch[1], 10);
        installmentTotal = parseInt(parenMatch[2], 10);
        instMatch = parenMatch;
      } else {
        instMatch = stringForInstallment.match(installmentRegex) || stringForInstallment.match(installmentDeRegex);
        if (instMatch) {
          isInstallment = true;
          installmentCurrent = parseInt(instMatch[1], 10);
          installmentTotal = parseInt(instMatch[2], 10);
        }
      }

      // Try to clean description description
      let cleanDesc = trimmed;
      // Remove parsed date from text
      if (dateMatch) cleanDesc = cleanDesc.replace(dateMatch[0], '');
      // Remove parsed amount text
      if (moneyMatches && moneyMatches.length > 0) {
        cleanDesc = cleanDesc.replace(moneyMatches[moneyMatches.length - 1], '');
      }
      // Remove R$ signs
      cleanDesc = cleanDesc.replace(/r\$\s*/gi, '');
      // Remove installment patterns
      if (instMatch) {
        cleanDesc = cleanDesc.replace(instMatch[0], '');
      }

      // Clean trailing and leading symbols
      cleanDesc = cleanDesc.replace(/^[\s\-;:\+,\|\*]+|[\s\-;:\+,\|\*]+$/g, '').trim();
      
      // Skip lines that have no meaningful description left
      if (cleanDesc.length < 3) continue;

      cleanedLines.push({
        raw: trimmed,
        date: parsedDateStr,
        description: cleanDesc,
        amount: parsedAmount,
        isInstallment,
        installmentCurrent,
        installmentTotal
      });
    }

    return cleanedLines;
  }

  /**
    * =========================================================================
    * 2. CAMADA: ESTRUTURADOR IA (BRIDGE)
    * =========================================================================
    * Passes the minimized clean payload to the parser endpoint to retrieve structured products.
    * Fallback in case of server failures is provided.
    */
  public static async queryStructuredIA(
    cleanLines: CleanLine[],
    fileExtension: string,
    parseAiCallback: (text: string, ext: string) => Promise<any>
  ): Promise<any[]> {
    if (cleanLines.length === 0) return [];

    // Bundle clean pre-parsed lines to reduce tokens heavily (avoids sending heavy random statement strings)
    const compactText = JSON.stringify(cleanLines.map(line => ({
      d: line.date,
      desc: line.description,
      val: line.amount,
      inst: line.isInstallment ? `${line.installmentCurrent}/${line.installmentTotal}` : null
    })), null, 2);

    try {
      const response = await parseAiCallback(compactText, 'json');
      // If the AI structured response exists, return it, mapped to full model expectations
      if (response && response.transactions) {
        return response.transactions.map((tx: any, index: number) => {
          const originalLine = cleanLines[index];
          let instCurr = 0;
          let instTot = 0;
          let isInst = false;
          
          if (tx.installments && String(tx.installments).includes('/')) {
            const parts = String(tx.installments).split('/');
            instCurr = parseInt(parts[0], 10) || 0;
            instTot = parseInt(parts[1], 10) || 0;
            isInst = instTot > 0;
          } else if (originalLine && originalLine.isInstallment) {
            instCurr = originalLine.installmentCurrent;
            instTot = originalLine.installmentTotal;
            isInst = true;
          }

          return {
            merchant: tx.merchant || originalLine?.description || tx.description || 'Compra',
            description: tx.description || originalLine?.description || 'Compra no Crédito',
            purchase_date: tx.date || originalLine?.date || format(new Date(), 'yyyy-MM-dd'),
            is_installment: isInst,
            installment_current: instCurr,
            installment_total: instTot,
            amount: tx.amount !== undefined ? tx.amount : (originalLine ? -Math.abs(originalLine.amount) : 0),
            category: tx.category || 'Outros',
            raw_text: tx.raw_text || originalLine?.raw || compactText
          };
        });
      }
    } catch (err) {
      console.warn('[FinancialImportService] AI estructurer crashed! Invoking heuristic client-side structuring fallback.', err);
    }

    // Heuristic client fallback (extremely important to survive if AI keys are unconfigured)
    return cleanLines.map(line => {
      // Analyze category heuristics
      let cat = 'Outros';
      const descLower = line.description.toLowerCase();
      if (/uber|pop99|99pop|cabify|taxi|metrô|metro|passagem|combustivel|posto|ipiranga|petrobras|shell/i.test(descLower)) cat = 'Transporte';
      else if (/restaurante|ifood|uber\s*eats|mcdonald|padaria|baker|comida|snack|gourmet|pizza|burger/i.test(descLower)) cat = 'Alimentação';
      else if (/netflix|spotify|prime\s*video|hbo|disney|steam|playstation|xbox|cinema/i.test(descLower)) cat = 'Entretenimento';
      else if (/drogaria|farmacia|medicina|hospital|clinica|consulta|odont/i.test(descLower)) cat = 'Saúde';
      else if (/havan|amazon|mercado\s*livre|shopee|magalu|magazine|loja|vestuario|renner|riachuelo|c&a/i.test(descLower)) cat = 'Compras';
      else if (/marisa|carrefour|extra|pao\s*de\s*acucar|assai|supermercado|feira|horti/i.test(descLower)) cat = 'Supermercado';

      return {
        merchant: line.description.toUpperCase(),
        description: line.description,
        purchase_date: line.date,
        is_installment: line.isInstallment,
        installment_current: line.installmentCurrent,
        installment_total: line.installmentTotal,
        amount: line.amount,
        category: cat,
        raw_text: line.raw
      };
    });
  }

  /**
    * =========================================================================
    * 3. CAMADA: MOTOR FINANCEIRO
    * =========================================================================
    * Reconstructs installments, updates parent records, and processes ledger transactions.
    */
  public static generateFingerprint(merchant: string, purchaseDate: string, installmentTotal: number, amount: number): string {
    const cleanMerchant = merchant.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    const cleanAmount = Math.abs(amount).toFixed(2);
    return `${cleanMerchant}|${purchaseDate}|${installmentTotal}|${cleanAmount}`;
  }

  /**
    * Reconstruct purchase and all of its associated installments inside storage/database.
    */
  public static async processImportedFinances(
    cardId: string,
    closingDay: number,
    dueDay: number,
    importedItems: any[]
  ): Promise<{
    createdPurchases: Purchase[];
    createdInstallments: PurchaseInstallment[];
    skippedInstallmentsCount: number;
  }> {
    const isSupabase = isSupabaseConfigured;
    
    // Fetch currently existing items to prevent duplicates list
    let existingPurchases: Purchase[] = [];
    let existingInstallments: PurchaseInstallment[] = [];

    if (isSupabase) {
      try {
        const { data: dbPur } = await supabase.from('purchases').select('*');
        const { data: dbInst } = await supabase.from('purchase_installments').select('*');
        existingPurchases = dbPur || [];
        existingInstallments = dbInst || [];
      } catch (e) {
        console.error('Error loading existing purchases from Supabase', e);
      }
    } else {
      const purLocal = localStorage.getItem('finna_purchases');
      const instLocal = localStorage.getItem('finna_purchase_installments');
      existingPurchases = purLocal ? JSON.parse(purLocal) : [];
      existingInstallments = instLocal ? JSON.parse(instLocal) : [];
    }

    const createdPurchases: Purchase[] = [];
    const createdInstallments: PurchaseInstallment[] = [];
    let skippedInstallmentsCount = 0;

    let userUUID: string | undefined = undefined;
    if (isSupabase) {
      const { data: { user } } = await supabase.auth.getUser();
      userUUID = user?.id;
    }

    for (const item of importedItems) {
      const isInst = !!item.is_installment;
      const amountVal = Math.abs(Number(item.amount || 0));
      const installmentTotal = isInst ? Number(item.installment_total || 1) : 1;
      const currentInst = isInst ? Number(item.installment_current || 1) : 1;

      // Ensure purchase date is complete and formatted
      let purchaseDate = item.purchase_date || format(new Date(), 'yyyy-MM-dd');
      if (purchaseDate.length === 5) {
        purchaseDate = `${new Date().getFullYear()}-${purchaseDate}`;
      }

      // 4. AGRUPAMENTO INTELIGENTE (Fingerprint fingerprint)
      const fingerprint = this.generateFingerprint(item.merchant, purchaseDate, installmentTotal, amountVal);

      // Search if a purchase with this exact footprint already exists or has been processed in this batch
      let matchedPurchase = existingPurchases.find(p => {
        const pFing = this.generateFingerprint(p.merchant, p.purchase_date, p.installments_total, p.installment_amount);
        return pFing === fingerprint;
      }) || createdPurchases.find(p => {
        const pFing = this.generateFingerprint(p.merchant, p.purchase_date, p.installments_total, p.installment_amount);
        return pFing === fingerprint;
      });

      if (!matchedPurchase) {
        // Create new Purchase original transaction record
        const pid = isSupabase ? undefined : 'pur-' + Math.random().toString(36).substring(2, 9);
        const newPurchase: Purchase = {
          id: pid || '',
          user_id: userUUID,
          merchant: item.merchant,
          description: item.description,
          category: item.category || 'Outros',
          purchase_date: purchaseDate,
          total_amount: amountVal * installmentTotal,
          installment_amount: amountVal,
          installments_total: installmentTotal,
          card_id: cardId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (isSupabase) {
          try {
            const { data, error } = await supabase.from('purchases').insert({
              user_id: userUUID,
              merchant: newPurchase.merchant,
              description: newPurchase.description,
              category: newPurchase.category,
              purchase_date: newPurchase.purchase_date,
              total_amount: newPurchase.total_amount,
              installment_amount: newPurchase.installment_amount,
              installments_total: newPurchase.installments_total,
              card_id: cardId
            }).select().single();
            if (error) throw error;
            newPurchase.id = data.id;
          } catch (err) {
            console.error('Failed to save purchase to Supabase. Elevating local mock UUID.', err);
            newPurchase.id = 'pur-' + Math.random().toString(36).substring(2, 9);
          }
        }
        createdPurchases.push(newPurchase);
        matchedPurchase = newPurchase;
      }

      // GERAÇÃO DE PARCELAS FUTURAS PROJECTION (Regra de Geração de Parcelas)
      // We generate ALL installments from 1 to installmentTotal automatically
      for (let i = 1; i <= installmentTotal; i++) {
        // Calculate invoice due date and reference month
        // Month index shift is i - currentInst
        const monthsToAdd = i - currentInst;
        
        let billingMonthStr = '';
        let devDueDateStr = '';

        try {
          const baseDateObj = parseISO(purchaseDate);
          if (isValid(baseDateObj)) {
            // Adjust base date if purchase date was after the card closing day
            let adjustedBaseDate = baseDateObj;
            const purchaseDayNum = baseDateObj.getDate();
            if (purchaseDayNum > closingDay) {
              adjustedBaseDate = addMonths(baseDateObj, 1);
            }

            // Target month shifts relative to purchase date
            const targetMonthDate = addMonths(adjustedBaseDate, monthsToAdd);
            billingMonthStr = format(targetMonthDate, 'yyyy-MM');
            
            // Due date is due_day of that targeted month
            const yearNum = targetMonthDate.getFullYear();
            const monthNum = targetMonthDate.getMonth() + 1; // 1-indexed
            
            // Format due date YYYY-MM-DD cleanly using dueDay, handling month caps
            const cappedDay = Math.min(dueDay, 28); // Safe day cap to prevent leap/short months calendar issues
            devDueDateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(cappedDay).padStart(2, '0')}`;
          }
        } catch (e) {
          console.error(e);
        }

        if (!billingMonthStr) {
          billingMonthStr = format(addMonths(new Date(), monthsToAdd), 'yyyy-MM');
          devDueDateStr = `${billingMonthStr}-${String(dueDay).padStart(2, '0')}`;
        }

        // status: parcelas anteriores ao atual = 'paid', atual e futuras = 'pending'
        const installmentStatus = i < currentInst ? 'paid' : 'pending';
        const paidAt = i < currentInst ? purchaseDate : null;

        // Verify if installment already exists in db/localStorage to avoid double inserts
        const isDuplicateInst = existingInstallments.some(inst => 
          inst.purchase_id === matchedPurchase?.id && 
          inst.installment_number === i
        );

        if (isDuplicateInst) {
          skippedInstallmentsCount++;
          continue;
        }

        const newInstallment: PurchaseInstallment = {
          id: isSupabase ? '' : 'inst-' + Math.random().toString(36).substring(2, 9),
          purchase_id: matchedPurchase.id,
          installment_number: i,
          amount: amountVal,
          due_date: devDueDateStr,
          invoice_reference_month: billingMonthStr,
          status: installmentStatus,
          paid_at: paidAt,
          created_at: new Date().toISOString()
        };

        if (isSupabase) {
          try {
            const { data, error } = await supabase.from('purchase_installments').insert({
              purchase_id: matchedPurchase.id,
              installment_number: newInstallment.installment_number,
              amount: newInstallment.amount,
              due_date: newInstallment.due_date,
              invoice_reference_month: newInstallment.invoice_reference_month,
              status: newInstallment.status,
              paid_at: newInstallment.paid_at
            }).select().single();
            if (error) {
              console.error('Failed to insert installment in Supabase: ', error);
            } else {
              newInstallment.id = data.id;
            }
          } catch (err) {
            console.error(err);
            newInstallment.id = 'inst-' + Math.random().toString(36).substring(2, 9);
          }
        }
        
        createdInstallments.push(newInstallment);
      }
    }

    // Save final offline structures
    if (!isSupabase) {
      const updatedPurchases = [...createdPurchases, ...existingPurchases];
      const updatedInstallments = [...createdInstallments, ...existingInstallments];
      localStorage.setItem('finna_purchases', JSON.stringify(updatedPurchases));
      localStorage.setItem('finna_purchase_installments', JSON.stringify(updatedInstallments));
    }

    // Reconstruct standard "transactions" ledger to main consistency page!
    // This allows existing transaction charts, budgets, and balance counters to immediately adapt to the new paradigm!
    const standardTransactionsToSave = createdInstallments.map(inst => {
      const matchPurch = createdPurchases.find(p => p.id === inst.purchase_id) || existingPurchases.find(p => p.id === inst.purchase_id);
      const merchantLabel = matchPurch ? matchPurch.merchant : 'Compra Parcelada';
      const installmentLabel = matchPurch ? `(${inst.installment_number}/${matchPurch.installments_total})` : '';
      
      let txDate = `${inst.invoice_reference_month}-15`; // Default fallback of target cycle
      if (matchPurch) {
        try {
          const originalDay = parseISO(matchPurch.purchase_date).getDate();
          const [year, month] = inst.invoice_reference_month.split('-');
          const targetDate = new Date(Number(year), Number(month) - 1, 15);
          const lastDayOfMonth = new Date(Number(year), Number(month), 0).getDate();
          const safeDay = Math.min(originalDay, lastDayOfMonth);
          targetDate.setDate(safeDay);
          txDate = format(targetDate, 'yyyy-MM-dd');
        } catch (e) {
          console.error('Error computing matching legacy tx date:', e);
        }
      }

      return {
        id: isSupabase ? undefined : 'tx-' + Math.random().toString(36).substring(2, 9),
        user_id: userUUID,
        description: `${merchantLabel} ${installmentLabel}`.trim(),
        amount: -Math.abs(inst.amount), // expense (negative)
        category: matchPurch ? matchPurch.category : 'Outros',
        date: txDate,
        type: 'expense',
        status: inst.status === 'paid' ? 'completed' : 'pending',
        installments: matchPurch ? `${inst.installment_number}/${matchPurch.installments_total}` : null,
        emotion: 'Neutro',
        source: 'Importação Financeira Inteligente',
        card_id: cardId,
        created_at: new Date().toISOString()
      };
    });

    if (standardTransactionsToSave.length > 0) {
      if (isSupabase) {
        try {
          await supabase.from('transactions').insert(standardTransactionsToSave);
        } catch (e) {
          console.error('Failed copying ledger entries to legacy transactions table in Supabase:', e);
        }
      } else {
        const legacyTxsSaved = localStorage.getItem('finna_transactions');
        const legacyList = legacyTxsSaved ? JSON.parse(legacyTxsSaved) : [];
        localStorage.setItem('finna_transactions', JSON.stringify([...standardTransactionsToSave, ...legacyList]));
      }
    }

    return {
      createdPurchases,
      createdInstallments,
      skippedInstallmentsCount
    };
  }

  /**
    * Load and compute analytics predictions on upcoming credit cards invoice using the new purchase and purchase_installments DB layout
    */
  public static async loadFinancialProjections(cardId?: string): Promise<{
    byMonth: Record<string, number>;
    upcomingDividends: { month: string; amount: number; description: string; count: number }[];
    totalDebt: number;
    installments: (PurchaseInstallment & { purchaseMerchant?: string; purchaseCategory?: string })[];
  }> {
    const isSupabase = isSupabaseConfigured;
    let purchases: Purchase[] = [];
    let installments: PurchaseInstallment[] = [];

    if (isSupabase) {
      try {
        const { data: dbPur } = await supabase.from('purchases').select('*');
        const { data: dbInst } = await supabase.from('purchase_installments').select('*');
        purchases = dbPur || [];
        installments = dbInst || [];
      } catch (e) {
        console.error('Error fetching projections from Supabase:', e);
      }
    } else {
      const purLocal = localStorage.getItem('finna_purchases');
      const instLocal = localStorage.getItem('finna_purchase_installments');
      purchases = purLocal ? JSON.parse(purLocal) : [];
      installments = instLocal ? JSON.parse(instLocal) : [];
    }

    // Filter by cardId if present
    if (cardId) {
      const purchasedOnThisCard = purchases.filter(p => p.card_id === cardId);
      const purchaseIds = purchasedOnThisCard.map(p => p.id);
      installments = installments.filter(inst => purchaseIds.includes(inst.purchase_id));
      purchases = purchasedOnThisCard;
    }

    const byMonth: Record<string, number> = {};
    let totalDebt = 0;

    const mappedInstallments = installments.map(inst => {
      const pur = purchases.find(p => p.id === inst.purchase_id);
      
      const amt = Number(inst.amount || 0);
      const isPending = inst.status === 'pending';
      const refMonth = inst.invoice_reference_month;

      if (isPending) {
        byMonth[refMonth] = (byMonth[refMonth] || 0) + amt;
        totalDebt += amt;
      }

      return {
        ...inst,
        purchaseMerchant: pur ? pur.merchant : 'Dispendio',
        purchaseCategory: pur ? pur.category : 'Outros'
      };
    });

    const upcomingDividends = Object.keys(byMonth).sort().map(month => ({
      month,
      amount: byMonth[month],
      description: `Fatura referente a ${month}`,
      count: mappedInstallments.filter(inst => inst.invoice_reference_month === month && inst.status === 'pending').length
    }));

    return {
      byMonth,
      upcomingDividends,
      totalDebt,
      installments: mappedInstallments
    };
  }
}
