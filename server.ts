import app from './src/api.js';
import path from 'path';
import express from 'express';

// Setup Vite or Static File Serving
async function setupFrontend(app: any) {
  // Only setup static serving or Vite if NOT on Vercel
  if (process.env.VERCEL) return;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: any, res: any) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Start sequence
if (!process.env.VERCEL) {
  setupFrontend(app).then(() => {
    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export default app;
