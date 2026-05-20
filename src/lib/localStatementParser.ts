import { format, parse } from 'date-fns';

export interface LocalParsedTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  isSubscription: boolean;
  isRecurring: boolean;
  installments: string | null;
  suggestedEmotion: string;
}

export interface LocalParseResult {
  isCreditCard: boolean;
  transactions: LocalParsedTransaction[];
  insights: {
    wastes: string[];
    totalCurrentStatement: number;
    forecastNextMonth: number;
    futureInstallmentsTotal: number;
    analysis: string;
  };
}

/**
 * Automagically categorizes a transaction based on description keywords
 */
export function classifyCategory(description: string, amount: number): { category: string; isSubscription: boolean; isIncome: boolean; suggestedEmotion: string } {
  const desc = description.toLowerCase();
  
  // Pix or salary or deposit entries
  const isIncome = amount > 0 || /salario|salário|provimento|vencimento|ted recebida|doc recebido|rendimento|aplicacao resgate|resgate|estorno|reembolso|devolucao|devolução|refund|pix recebido|pix de|recebido|deposito|depósito/i.test(desc);
  
  if (isIncome) {
    return {
      category: 'Receitas',
      isSubscription: false,
      isIncome: true,
      suggestedEmotion: 'Aliviado'
    };
  }

  // Subscriptions search
  if (/netflix|spotify|hbo|disney|amazon prime|prime video|youtube.*prem|steam|crunchyroll|adobe|apple.*bill|google.*storage|cloud|github|gpt|openai|microsoft|game pass/i.test(desc)) {
    return {
      category: 'Assinaturas',
      isSubscription: true,
      isIncome: false,
      suggestedEmotion: 'Tranquilo'
    };
  }

  // Transport and Fuel
  if (/uber|99pop|cabify|itau.*bike|metro|metrô|cptm|sptrans|combustivel|combustível|posto|gasolina|gasol|ipiranga|shell|br.*petrobras|pedagio|pedágio|semparar|veloe/i.test(desc)) {
    return {
      category: 'Transporte',
      isSubscription: false,
      isIncome: false,
      suggestedEmotion: 'Neutro'
    };
  }

  // Food and Groceries
  if (/ifood|mcdonald|burguer king|bk |subway|habib|restaurante|pizzaria|churrascaria|padaria|panificadora|confeitaria|doceria|cafe |café|starbucks|supermercado|mercado|carrefour|pao de acucar|pão de açúcar|extra|hiper|atacado|assai|sendas|zona sul/i.test(desc)) {
    return {
      category: 'Alimentação',
      isSubscription: false,
      isIncome: false,
      suggestedEmotion: 'Satisfeito'
    };
  }

  // Health and Pharma
  if (/farmacia|farmácia|drogaria|drogasil|pague menos|raia|panvel|medico|médico|dentista|hospital|saude|saúde|clinica|clínica|exame|laboratorio/i.test(desc)) {
    return {
      category: 'Saúde',
      isSubscription: false,
      isIncome: false,
      suggestedEmotion: 'Aliviado'
    };
  }

  // Apparel & Fashion
  if (/loja.*roup|vestuario|vestuário|calcado|calçado|zara|c&a|renner|riachuelo|nike|adidas|centauro|decathlon|hering|arezzo|fatto/i.test(desc)) {
    return {
      category: 'Vestuário',
      isSubscription: false,
      isIncome: false,
      suggestedEmotion: 'Empolgado'
    };
  }

  // Education
  if (/escola|colegio|colégio|faculdade|universidade|curso|udemy|hotmart|alura|livraria|saraiva|cultura|mensalidade/i.test(desc)) {
    return {
      category: 'Educação',
      isSubscription: false,
      isIncome: false,
      suggestedEmotion: 'Produtivo'
    };
  }

  // Home bills
  if (/aluguel|condominio|condomínio|enel|light|copel|cpas|sabesp|sanepar|cagece|coelba|claro|vivo|tim|oi.*tele|net.*servico/i.test(desc)) {
    return {
      category: 'Moradia',
      isSubscription: false,
      isIncome: false,
      suggestedEmotion: 'Neutro'
    };
  }

  // Entertainment / Leisure
  if (/cinema|teatro|ingresso|show|bacon|cerveja|bar |pub|boate|festa|viagem|decolar|booking|airbnb|hospedagem|hotel/i.test(desc)) {
    return {
      category: 'Lazer',
      isSubscription: false,
      isIncome: false,
      suggestedEmotion: 'Empolgado'
    };
  }

  return {
    category: 'Outros',
    isSubscription: false,
    isIncome: false,
    suggestedEmotion: 'Neutro'
  };
}

/**
 * Parses YYYYMMDD or text with DD/MM/YYYY into ISO YYYY-MM-DD
 */
function normalizeDate(rawDate: string): string {
  const clean = rawDate.trim().replace(/[^\d/-]/g, '');
  const nowStr = format(new Date(), 'yyyy-MM-dd');
  
  // YYYYMMDD (OFX standard)
  if (/^\d{8}$/.test(clean)) {
    return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(clean)) {
    const separator = clean.includes('/') ? '/' : '-';
    const parts = clean.split(separator);
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // DD/MM/YY
  if (/^\d{2}[/-]\d{2}[/-]\d{2}$/.test(clean)) {
    const separator = clean.includes('/') ? '/' : '-';
    const parts = clean.split(separator);
    return `20${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // DD/MM
  if (/^\d{2}[/-]\d{2}$/.test(clean)) {
    const separator = clean.includes('/') ? '/' : '-';
    const parts = clean.split(separator);
    const year = new Date().getFullYear();
    return `${year}-${parts[1]}-${parts[0]}`;
  }

  return nowStr;
}

/**
 * Standard OFX Statement Parser
 */
export function parseOFXLocal(text: string): LocalParseResult | null {
  if (!text.includes('<OFX>') && !text.includes('<STMTTRN>')) {
    return null;
  }

  const transactions: LocalParsedTransaction[] = [];
  // Match STMTTRN tags
  const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = trnRegex.exec(text)) !== null) {
    const block = match[1];
    
    // Extract pieces
    const trntypeMatch = block.match(/<TRNTYPE>(.*)/i);
    const dtpostedMatch = block.match(/<DTPOSTED>(\d{8})/i);
    const trnamtMatch = block.match(/<TRNAMT>([-.\d]+)/i);
    const memoMatch = block.match(/<MEMO>([^<\r\n]+)/i);
    const fitidMatch = block.match(/<FITID>([^<\r\n]+)/i);

    const rawMemo = memoMatch ? memoMatch[1].trim() : (fitidMatch ? fitidMatch[1].trim() : 'Transação Importada');
    const rawAmt = trnamtMatch ? parseFloat(trnamtMatch[1]) : 0;
    const rawDate = dtpostedMatch ? dtpostedMatch[1] : '';

    if (rawAmt === 0) continue;

    const formattedDate = rawDate ? normalizeDate(rawDate) : format(new Date(), 'yyyy-MM-dd');
    const classification = classifyCategory(rawMemo, rawAmt);

    transactions.push({
      date: formattedDate,
      description: rawMemo,
      amount: rawAmt,
      category: classification.category,
      isSubscription: classification.isSubscription,
      isRecurring: classification.isSubscription,
      installments: null,
      suggestedEmotion: classification.suggestedEmotion
    });
  }

  if (transactions.length === 0) return null;

  // Compute stats
  const totalCurrentStatement = transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const isCreditCard = text.toUpperCase().includes('CREDITCARD') || text.toUpperCase().includes('CCSTMT');

  return {
    isCreditCard,
    transactions,
    insights: {
      wastes: findWastesLocally(transactions),
      totalCurrentStatement,
      forecastNextMonth: totalCurrentStatement * 1.05,
      futureInstallmentsTotal: 0,
      analysis: 'Extrato OFX lido localmente com sucesso! Análise estruturada completa realizada offline para garantir máxima velocidade.'
    }
  };
}

/**
 * Clean CSV file parser
 */
export function parseCSVLocal(text: string): LocalParseResult | null {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return null;

  // Let's identify the delimiter: comma or semicolon or tab
  const sample = lines[0];
  const delimiter = sample.includes(';') ? ';' : (sample.includes('\t') ? '\t' : ',');

  const rows = lines.map(line => {
    // Basic CSV splitting handling simple quotes
    const parts: string[] = [];
    let insideQuotes = false;
    let currentPart = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delimiter && !insideQuotes) {
        parts.push(currentPart.trim());
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    parts.push(currentPart.trim());
    return parts;
  });

  const headers = rows[0].map(h => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  
  // Find column indices
  let dateIdx = headers.findIndex(h => h.includes('data') || h.includes('date') || h.includes('dt'));
  let descIdx = headers.findIndex(h => h.includes('desc') || h.includes('historico') || h.includes('memo') || h.includes('title') || h.includes('detalhe'));
  let amtIdx = headers.findIndex(h => h.includes('valor') || h.includes('quant') || h.includes('amount') || h.includes('preco') || h.includes('preço'));

  // Fallbacks if headers match failed (try position based)
  if (dateIdx === -1 && rows[1] && rows[1].length > 0) {
    // First column that matches date regex
    dateIdx = rows[1].findIndex(val => /^\d{2}[/-]\d{2}[/-]\d{2,4}$|^\d{4}-\d{2}-\d{2}$/.test(val));
  }
  if (amtIdx === -1 && rows[1] && rows[1].length > 0) {
    // Col that has numeric representation
    amtIdx = rows[1].findIndex(val => /[-+]?[\d.,]+/.test(val) && !val.includes('/') && val.length < 15);
  }
  if (descIdx === -1 && rows[1]) {
    // Pick first column of string content that isn't date or amt
    descIdx = rows[1].findIndex((val, idx) => idx !== dateIdx && idx !== amtIdx && val.length > 2);
  }

  // Adjust default column alignments
  if (dateIdx === -1) dateIdx = 0;
  if (descIdx === -1) descIdx = 1;
  if (amtIdx === -1) amtIdx = rows[0].length > 2 ? 2 : 1;

  const transactions: LocalParsedTransaction[] = [];

  // Parse remaining rows
  for (let idx = 1; idx < rows.length; idx++) {
    const r = rows[idx];
    if (r.length <= Math.max(dateIdx, descIdx, amtIdx)) continue;

    const rawDate = r[dateIdx];
    const rawDesc = r[descIdx];
    const rawAmtStr = r[amtIdx];

    if (!rawDate || !rawDesc || !rawAmtStr) continue;

    // Clean numeric values, handle R$ 15,20 or (50,00) or -100
    let cleanedAmt = rawAmtStr
      .replace(/R\$/gi, '')
      .replace(/\s/g, '')
      .replace(/\./g, '') // remove thousands dot
      .replace(',', '.');  // replace decimal comma with dot

    // Handle parenthesis representation (e.g. "(150)" turns into "-150")
    if (cleanedAmt.startsWith('(') && cleanedAmt.endsWith(')')) {
      cleanedAmt = '-' + cleanedAmt.replace(/[()]/g, '');
    }

    const amount = parseFloat(cleanedAmt);
    if (isNaN(amount) || amount === 0) continue;

    const formattedDate = normalizeDate(rawDate);
    const classification = classifyCategory(rawDesc, amount);

    transactions.push({
      date: formattedDate,
      description: rawDesc,
      amount: amount,
      category: classification.category,
      isSubscription: classification.isSubscription,
      isRecurring: classification.isSubscription,
      installments: null,
      suggestedEmotion: classification.suggestedEmotion
    });
  }

  if (transactions.length === 0) return null;

  const totalCurrentStatement = transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const isCreditCard = text.toLowerCase().includes('fatura') || text.toLowerCase().includes('limite') || text.toLowerCase().includes('cartao');

  return {
    isCreditCard,
    transactions,
    insights: {
      wastes: findWastesLocally(transactions),
      totalCurrentStatement,
      forecastNextMonth: totalCurrentStatement * 1.05,
      futureInstallmentsTotal: 0,
      analysis: 'Tabela CSV decodificada localmente de forma instantânea! Conexão de rede e chaves poupadas com sucesso.'
    }
  };
}

/**
 * Text parsing fallback
 */
export function parseTextHeuristics(text: string): LocalParseResult {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  const transactions: LocalParsedTransaction[] = [];

  // Regex to detect common transaction patterns: Date + Desc + Value
  // E.g. "20/05/2026 Supermercado R$ -150,00" or "2026-05-15 PIX OUT R$ 10.00"
  const linePattern = /(\d{2}[/-]\d{2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\s+([A-Za-z0-9\sªº\-\.\*\/]+?)\s+([R$-]*\s*[-+]?[\d.,]+)/i;

  lines.forEach(l => {
    const match = l.match(linePattern);
    if (match) {
      const rawDate = match[1];
      const rawDesc = match[2].trim();
      const rawAmtStr = match[3];

      let cleanedAmt = rawAmtStr
        .replace(/R\$/gi, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

      const amount = parseFloat(cleanedAmt);
      if (!isNaN(amount) && amount !== 0) {
        const formattedDate = normalizeDate(rawDate);
        const classification = classifyCategory(rawDesc, amount);

        transactions.push({
          date: formattedDate,
          description: rawDesc,
          amount: amount,
          category: classification.category,
          isSubscription: classification.isSubscription,
          isRecurring: classification.isSubscription,
          installments: null,
          suggestedEmotion: classification.suggestedEmotion
        });
      }
    }
  });

  // If no transactions found by strict patterns, split into tokens
  if (transactions.length === 0) {
    lines.forEach(l => {
      // Find any date in string
      const dateMatch = l.match(/(\d{2}[/-]\d{2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/);
      // Find any decimal value in string
      const amtMatch = l.match(/[-+R$]*\s*[-+]?\d+,\d{2}|[-+R$]*\s*[-+]?\d+\.\d{2}/);
      
      if (dateMatch && amtMatch) {
        const d = dateMatch[1];
        const valStr = amtMatch[0];
        let desc = l.replace(d, '').replace(valStr, '').replace(/R\$/g, '').trim();
        
        let cleanedAmt = valStr
          .replace(/R\$/gi, '')
          .replace(/\s/g, '')
          .replace(/\./g, '')
          .replace(',', '.');

        const amount = parseFloat(cleanedAmt);

        if (!isNaN(amount) && amount !== 0 && desc.length > 1) {
          // Clean desc
          desc = desc.replace(/^[-+;:,]+/g, '').trim();
          const formattedDate = normalizeDate(d);
          const classification = classifyCategory(desc, amount);

          transactions.push({
            date: formattedDate,
            description: desc || 'Compra no Crédito',
            amount,
            category: classification.category,
            isSubscription: classification.isSubscription,
            isRecurring: classification.isSubscription,
            installments: null,
            suggestedEmotion: classification.suggestedEmotion
          });
        }
      }
    });
  }

  const totalCurrentStatement = transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
  const isCreditCard = text.toLowerCase().includes('fatura') || text.toLowerCase().includes('limite') || text.toLowerCase().includes('cartão');

  return {
    isCreditCard,
    transactions,
    insights: {
      wastes: findWastesLocally(transactions),
      totalCurrentStatement,
      forecastNextMonth: totalCurrentStatement * 1.05,
      futureInstallmentsTotal: 0,
      analysis: 'Heurística analítica de texto livre concluída! Os lançamentos foram segmentados linha a linha.'
    }
  };
}

/**
 * Searches for subscription or duplicate/excessive wastes locally
 */
function findWastesLocally(txs: LocalParsedTransaction[]): string[] {
  const wastes: string[] = [];
  const subs = txs.filter(t => t.isSubscription);
  
  if (subs.length > 3) {
    wastes.push(`Identificamos ${subs.length} assinaturas recorrentes ativas. Analise serviços de streaming que você usa pouco para economizar.`);
  }

  // Find duplicates
  const counts: Record<string, number> = {};
  txs.forEach(t => {
    if (t.amount < 0) {
      const key = `${t.description.toLowerCase().substring(0, 8)}_${Math.abs(t.amount)}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  const duplicates = Object.keys(counts).filter(k => counts[k] > 1);
  if (duplicates.length > 0) {
    wastes.push(`Atenção: existem transações com valores idênticos repetidas no mesmo dia. Verifique se recebeu cobrança duplicated.`);
  }

  // General fallback
  if (wastes.length === 0) {
    wastes.push('Nenhum vazamento financeiro crítico ou assinatura redundante identificada neste extrato.');
  }

  return wastes;
}

/**
 * Master controller that parses statement text and handles fallbacks gracefully
 */
export function intelligentLocalParser(text: string): LocalParseResult {
  try {
    // 1. Try OFX
    const ofx = parseOFXLocal(text);
    if (ofx && ofx.transactions.length > 0) return ofx;

    // 2. Try CSV
    const csv = parseCSVLocal(text);
    if (csv && csv.transactions.length > 0) return csv;

    // 3. Heuristics fallback
    return parseTextHeuristics(text);
  } catch (err) {
    console.warn('[localParser] Failed structured parse, using heuristics:', err);
    return parseTextHeuristics(text);
  }
}
