import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { attachErrorHandler, createApiApp } from './apiApp';
import { ensureDbInitialized } from './db';

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  await ensureDbInitialized();

  const app = createApiApp();

  if (process.env.NODE_ENV !== 'production') {
    if (!process.env.RAYON_NUM_THREADS) {
      process.env.RAYON_NUM_THREADS = '1';
    }
    if (!process.env.UV_THREADPOOL_SIZE) {
      process.env.UV_THREADPOOL_SIZE = '2';
    }
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  attachErrorHandler(app);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FinTrack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
