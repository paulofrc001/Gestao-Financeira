import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Gemini AI Setup
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Helper for AI calls with retry
  async function generateWithRetry(params: any, retries = 3) {
    for (let i = 0; i <= retries; i++) {
       try {
          // Use gemini-3-flash-preview as default if not specified
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
             const waitTime = (i + 1) * 2000; // Increased backoff
             console.log(`AI busy or rate limited (429/503), retrying in ${waitTime}ms... (${i + 1}/${retries})`);
             await new Promise(resolve => setTimeout(resolve, waitTime));
             continue;
          }
          throw error;
       }
    }
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Endpoint for IA Insights
  app.post('/api/ai/insights', async (req, res) => {
    console.log('[API] Generating insights...');
    try {
      const { transactions, goals } = req.body;
      
      if (!transactions) {
        return res.status(400).json({ error: 'Faltando transações para análise' });
      }

      const prompt = `
        Aja como um consultor financeiro familiar especialista. 
        Analise as seguintes transações e metas:
        Transações: ${JSON.stringify(transactions)}
        Metas: ${JSON.stringify(goals)}
        
        Forneça:
        1. 3 insights acionáveis sobre padrões de gastos.
        2. Alertas se houver gastos impulsivos detectados.
        3. Uma sugestão para economizar baseada no histórico.
        
        Responda em formato JSON:
        {
          "insights": [{"title": "String", "content": "String", "type": "alert|suggestion|pattern"}],
          "summary": "String resumo"
        }
      `;

      const result = await generateWithRetry({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
      
      console.log('[API] Insights generated');
      res.json(JSON.parse(result.text || '{}'));
    } catch (error: any) {
      console.error('AI Insight Error:', error);
      const isRateLimit = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
      res.status(isRateLimit ? 429 : 500).json({ 
        error: isRateLimit ? 'Muitas solicitações à IA. Por favor, aguarde um momento.' : error.message 
      });
    }
  });

  // Chat AI Assistente
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, history } = req.body;
      
      // Simple retry for chat manually since we can't use generateWithRetry directly for chat sessions easily with this SDK pattern
      let response;
      const chat = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: 'Você é o Finna, um assistente de gestão financeira familiar. Seja educado, profissional e ajude a família a economizar e ter controle emocional sobre o dinheiro.'
        }
      });

      for (let i = 0; i <= 3; i++) {
        try {
          response = await chat.sendMessage({ message });
          break;
        } catch (error: any) {
          const errorMessage = error.message?.toLowerCase() || '';
          const isRetryable = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('503') || errorMessage.includes('overloaded');
          
          if (isRetryable && i < 3) {
            await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
            continue;
          }
          throw error;
        }
      }
      
      if (!response) throw new Error('No response from AI');
      res.json({ text: response.text });
    } catch (error: any) {
      const isRateLimit = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
      res.status(isRateLimit ? 429 : 500).json({ 
        error: isRateLimit ? 'IA temporariamente ocupada (limite de quota). Tente em alguns segundos.' : error.message 
      });
    }
  });

  // Endpoint for Statement Parsing
  app.post('/api/ai/parse-statement', async (req, res) => {
    console.log('[API] Processing parse-statement request...');
    try {
      const { text, fileType } = req.body;
      
      if (!text) {
        console.warn('[API] Missing text in request');
        return res.status(400).json({ error: 'Faltando conteúdo do extrato' });
      }

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
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
      
      console.log('[API] Statement parsed successfully');
      res.json(JSON.parse(result.text || '{}'));
    } catch (error: any) {
      console.error('Statement Parse Error:', error);
      const isRateLimit = error.message?.includes('429') || error.message?.toLowerCase().includes('quota');
      res.status(isRateLimit ? 429 : 500).json({ 
        error: isRateLimit ? 'Limite de processamento da IA atingido. Tente novamente em 1 minuto.' : error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Finna Server running on http://localhost:${PORT}`);
  });
}

startServer();
