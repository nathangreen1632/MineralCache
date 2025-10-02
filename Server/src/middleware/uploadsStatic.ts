// Server/src/middleware/uploadsStatic.ts
import express from 'express';
import { UPLOADS_DIR, UPLOADS_PUBLIC_ROUTE, ensureUploadsReady } from '../controllers/products.controller.js';

export async function registerUploadsStatic(app: express.Express) {
  await ensureUploadsReady();
  app.use(
    UPLOADS_PUBLIC_ROUTE,
    express.static(UPLOADS_DIR.current, {
      index: false,
      etag: true,
      maxAge: '1y',
      fallthrough: true,
    }),
  );
}
