import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { serverRateLimiter } from './lib/rateLimiter.js';

dotenv.config();

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware for server rate limits on AI routes
function enforceServerRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Simple rate limiting key using IP or a generic token
  const ip = req.ip || req.headers['x-forwarded-for'] || 'global-server';
  const rateLimitKey = `server:api:${String(ip)}`;

  // Max 10 requests per rolling minute on backend
  const status = serverRateLimiter.check(rateLimitKey, 10, 60000);

  if (status.limited) {
    console.warn(`[Backend RateLimiter] Blocked IP: ${ip}. Wait ${status.retryAfter}ms.`);
    res.setHeader('Retry-After', Math.ceil(status.retryAfter / 1000));
    return res.status(429).json({
      error: '⚠️ O servidor registrou excesso de requisições de IA. Aguarde um momento para não esgotar as chaves de acesso.',
      retryAfterMs: status.retryAfter
    });
  }

  next();
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    env: process.env.NODE_ENV,
    hasGeminiKey: !!process.env.GEMINI_API_KEY 
  });
});

// Helper for AI calls with retry and model fallback
async function generateWithRetry(params: any, retries = 3) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Chave GEMINI_API_KEY não encontrada no ambiente do servidor.');
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Array of models to try in sequence of availability
  const modelsToTry = [
    params.model || 'gemini-3.5-flash',
    'gemini-2.5-flash'
  ];

  for (const modelCandidate of modelsToTry) {
    console.log(`[API] Attempting model: ${modelCandidate}`);
    
    for (let i = 0; i <= retries; i++) {
       try {
          const currentParams = { ...params, model: modelCandidate };
          return await ai.models.generateContent(currentParams);
       } catch (error: any) {
          const errorMessage = error.message?.toLowerCase() || '';
          const isRetryable = errorMessage.includes('429') || 
                            errorMessage.includes('too many requests') ||
                            errorMessage.includes('503') || 
                            errorMessage.includes('overloaded') || 
                            errorMessage.includes('high demand') ||
                            errorMessage.includes('quota');
          
          if (isRetryable && i < retries) {
             const waitTime = (i + 1) * 2000;
             console.log(`[API] AI busy or rate limited (429/503) for model ${modelCandidate}. Retrying in ${waitTime}ms... (${i + 1}/${retries})`);
             await new Promise(resolve => setTimeout(resolve, waitTime));
             continue;
          }
          
          // If we failed with 429 and have another fallback model Candidate, print warning and continue to fallback model
          if (isRetryable && modelsToTry.indexOf(modelCandidate) < modelsToTry.length - 1) {
             console.warn(`[API] Model ${modelCandidate} failed with quota/429. Switching immediately to fallback candidate.`);
             break; // breaks inner retry, moves to next model candidate
          }
          
          throw error;
       }
    }
  }
}

app.post('/api/ai/insights', enforceServerRateLimit, async (req, res) => {
  console.log('[API] Generating insights...');
  try {
    const { transactions, goals } = req.body;
    if (!transactions) return res.status(400).json({ error: 'Faltando transações' });

    const prompt = `
      Analise transações e metas financeiras:
      Transações: ${JSON.stringify(transactions)}
      Metas: ${JSON.stringify(goals)}
      Retorne JSON com 3 insights acionáveis e um resumo.
    `;

    const result = await generateWithRetry({
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    
    res.json(JSON.parse(result.text || '{}'));
  } catch (error: any) {
    console.error('AI Insight Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/chat', enforceServerRateLimit, async (req, res) => {
  console.log('[API] Processing Chat...');
  try {
    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');

    const ai = new GoogleGenAI({ apiKey });
    
    // We try to use a fallback logic directly for chat message
    let response;
    const chatModels = ['gemini-3.5-flash', 'gemini-2.5-flash'];
    let chatError = null;

    for (const chatModel of chatModels) {
      const chat = ai.chats.create({
        model: chatModel,
        config: {
          systemInstruction: 'Você é o Finna, assistente financeiro familiar.'
        }
      });
      
      try {
        response = await chat.sendMessage({ message });
        chatError = null;
        break; // Success!
      } catch (err: any) {
        console.warn(`[API] Chat model ${chatModel} failed: ${err.message}. Trying next if available.`);
        chatError = err;
      }
    }

    if (chatError) throw chatError;
    res.json({ text: response?.text || '' });
  } catch (error: any) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/parse-statement', enforceServerRateLimit, async (req, res) => {
  console.log('[API] Processing parse-statement request with pre-parsed compact text...');
  try {
    const { text, fileType } = req.body;
    if (!text) return res.status(400).json({ error: 'Faltando texto' });

    const prompt = `
      Aja como um extrator e estruturador de dados de faturas e extratos de altíssima precisão. Sua única tarefa é estruturar as linhas financeiras pré-processadas fornecidas.
      
      ATENÇÃO: Não faça cálculos financeiros complexos, não projete parcelas futuras e não calcule regras de faturamento adicionais. Sua tarefa é apenas estruturar cada linha no formato solicitado.

      Formato de entrada (linhas simplificadas em JSON):
      ${text}

      Para cada item na lista, você deve extrair o nome do estabelecimento comercial ("merchant" simplificado e limpo), mantendo a descrição original ("description"), a data original da compra ("purchase_date" no formato de data YYYY-MM-DD), o valor ("amount" como número real de ponto flutuante, negativo para despesas), se é parcelado ("is_installment"), a parcela atual ("installment_current") e o total de parcelas ("installment_total"), e categorizar adequadamente ("category").

      Retorne APENAS um JSON no formato descrito abaixo:
      {
        "isCreditCard": true,
        "transactions": [
          {
            "merchant": "Nome do Estabelecimento limpo (ex: HAVAN)",
            "description": "Descrição original da compra (ex: HAVAN FRANCA)",
            "purchase_date": "YYYY-MM-DD (Data original de quando a compra ocorreu)",
            "amount": -239.99,
            "is_installment": true,
            "installment_current": 6,
            "installment_total": 10,
            "currency": "BRL",
            "category": "Shopping / Alimentação / Transporte / Etc",
            "raw_text": "Texto bruto da linha"
          }
        ]
      }
    `;

    const result = await generateWithRetry({
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    res.json(JSON.parse(result.text || '{}'));
  } catch (error: any) {
    console.error('Statement Parse Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default app;
