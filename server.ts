import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini AI Setup
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Endpoint for IA Insights
  app.post('/api/ai/insights', async (req, res) => {
    try {
      const { transactions, goals } = req.body;
      
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

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
        model: 'gemini-3-flash-preview',
        config: {
          systemInstruction: 'Você é o Finna, um assistente de gestão financeira familiar. Seja educado, profissional e ajude a família a economizar e ter controle emocional sobre o dinheiro.'
        }
      });

      const response = await chat.sendMessage({ message });
      res.json({ text: response.text });
    } catch (error: any) {
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
