import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    env: process.env.NODE_ENV,
    hasGeminiKey: !!process.env.GEMINI_API_KEY 
  });
});

// Helper for AI calls with retry
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

  for (let i = 0; i <= retries; i++) {
     try {
        if (!params.model) params.model = 'gemini-3-flash-preview';
        return await ai.models.generateContent(params);
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
           console.log(`AI busy or rate limited (429/503), retrying in ${waitTime}ms... (${i + 1}/${retries})`);
           await new Promise(resolve => setTimeout(resolve, waitTime));
           continue;
        }
        throw error;
     }
  }
}

app.post('/api/ai/insights', async (req, res) => {
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

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');

    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: 'Você é o Finna, assistente financeiro familiar.'
      }
    });

    let response;
    for (let i = 0; i <= 3; i++) {
      try {
        response = await chat.sendMessage({ message });
        break;
      } catch (error: any) {
        if (i === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
      }
    }
    res.json({ text: response?.text || '' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/parse-statement', async (req, res) => {
  console.log('[API] Processing parse-statement request...');
  try {
    const { text, fileType } = req.body;
    if (!text) return res.status(400).json({ error: 'Faltando texto' });

    const prompt = `
      Aja como um extrator de dados financeiros de alto nível e analista preditivo.
      Analise o texto abaixo extraído de um arquivo ${fileType}. Pode ser um extrato bancário ou uma fatura de CARTÃO DE CRÉDITO.
      
      TAREFAS:
      1. Extraia todas as transações possíveis.
      2. Identifique se o documento é uma FATURA DE CARTÃO DE CRÉDITO.
      3. Para cada transação: data (YYYY-MM-DD), descrição, valor (negativo para gastos), categoria, isSubscription, isRecurring.
      4. Categorização automática baseada em padrões.
      5. PREVISÃO: Se for cartão, identifique parcelamentos (ex: "Compra X 1/10") e projete gastos futuros.
      6. IA INSIGHTS: Identifique desperdícios, assinaturas duplicadas e sugira cortes.

      Texto do documento:
      ${text}
      
      Responda APENAS em formato JSON:
      {
        "isCreditCard": Boolean,
        "transactions": [
          {
            "date": "YYYY-MM-DD",
            "description": "String",
            "amount": Number,
            "category": "String",
            "isSubscription": Boolean,
            "isRecurring": Boolean,
            "installments": "String (ex: '1/5') ou null",
            "suggestedEmotion": "String"
          }
        ],
        "insights": {
           "wastes": ["String"],
           "totalCurrentStatement": Number,
           "forecastNextMonth": Number,
           "futureInstallmentsTotal": Number,
           "analysis": "String curta com tom de advisor financeiro"
        }
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
