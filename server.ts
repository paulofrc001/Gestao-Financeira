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
  async function generateWithRetry(params: any, retries = 2) {
    for (let i = 0; i <= retries; i++) {
       try {
          return await ai.models.generateContent(params);
       } catch (error: any) {
          if (i === retries) throw error;
          const isRetryable = error.message.includes('503') || error.message.includes('overloaded') || error.message.includes('high demand');
          if (isRetryable) {
             console.log(`AI high demand, retrying... (${i + 1}/${retries})`);
             await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential-ish backoff
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
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
      
      res.json(JSON.parse(result.text || '{}'));
    } catch (error: any) {
      console.error('AI Insight Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Chat AI Assistente
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, history } = req.body;
      const chat = ai.chats.create({
        model: 'gemini-flash-latest',
        config: {
          systemInstruction: 'Você é o Finna, um assistente de gestão financeira familiar. Seja educado, profissional e ajude a família a economizar e ter controle emocional sobre o dinheiro.'
        }
      });

      // Simple retry for chat
      let response;
      for (let i = 0; i <= 2; i++) {
        try {
          response = await chat.sendMessage({ message });
          break;
        } catch (error: any) {
          if (i === 2) throw error;
          const isRetryable = error.message.includes('503') || error.message.includes('overloaded') || error.message.includes('high demand');
          if (isRetryable) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            continue;
          }
          throw error;
        }
      }
      
      if (!response) throw new Error('No response from AI');
      res.json({ text: response.text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint for Statement Parsing
  app.post('/api/ai/parse-statement', async (req, res) => {
    try {
      const { text, fileType } = req.body;
      
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
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
      
      res.json(JSON.parse(result.text || '{}'));
    } catch (error: any) {
      console.error('Statement Parse Error:', error);
      res.status(500).json({ error: error.message });
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
