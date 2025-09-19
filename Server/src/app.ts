import express from 'express';
import path from 'node:path';
import helmet from 'helmet';
import compression from 'compression';
import cookieSession from 'cookie-session';
import morgan from 'morgan';
import apiRouter from './routes/index.js';

const app = express();

// Trust proxy (Render)
app.set('trust proxy', true);

// Security & perf
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(compression());
app.use(morgan('tiny'));

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Session cookie (same-origin, no CORS)
app.use(cookieSession({
  name: 'msession',
  secret: process.env.SESSION_SECRET || 'dev-secret',
  sameSite: 'lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
}));

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Mount your API routers under /api

app.use('/api', apiRouter);

// Static uploads (Render disk)
const uploadsDir = process.env.UPLOADS_DIR || '/var/data/uploads';
app.use('/uploads', express.static(uploadsDir, {
  fallthrough: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// In production, serve the client build from the API server (same origin)
if (process.env.NODE_ENV === 'production') {
  const clientDir = path.resolve(process.cwd(), 'Client', 'dist');
  app.use(express.static(clientDir, { index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}

export default app;
