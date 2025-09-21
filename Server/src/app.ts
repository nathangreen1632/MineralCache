import express from 'express';
import path from 'node:path';
import helmet from 'helmet';
import compression from 'compression';
import cookieSession from 'cookie-session';
import morgan from 'morgan';
import apiRouter from './routes/index.js';
import { db } from './models/sequelize.js';
import 'dotenv/config';

// ✅ attach session user onto req.user everywhere
import { attachUser } from './middleware/authz.middleware.js';

const app = express();

// Trust proxy (Render)
app.set('trust proxy', true);

// Security & perf
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(compression());
app.use(morgan('tiny'));

// Body parsers (JSON/urlencoded). Stripe webhook uses route-level raw parser.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Session cookie (same-origin, no CORS)
app.use(
  cookieSession({
    name: 'msession',
    secret: process.env.SESSION_SECRET || 'dev-secret',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
);

// ✅ Make the user available on req.user for all downstream handlers
app.use(attachUser);

// ----------------------
// Health endpoints
// ----------------------
const HEALTH_PATH = '/api/health';
const READY_PATH = '/api/ready';

app.get(HEALTH_PATH, (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() })
);

app.get(READY_PATH, async (_req, res) => {
  const result = await db.ping();
  if (result.ok) {
    res.json({ ok: true, db: 'up', ts: new Date().toISOString() });
  } else {
    res
      .status(503)
      .json({ ok: false, db: 'down', error: result.error, ts: new Date().toISOString() });
  }
});

// Print easy dev hints once this module loads (works when imported by server.ts)
if (process.env.NODE_ENV !== 'production') {
  const port = Number(process.env.PORT || 4000);
  const url = `http://localhost:${port}`;
  // eslint-disable-next-line no-console
  console.log(`[health] GET ${HEALTH_PATH}  →  ${url}${HEALTH_PATH}`);
  // eslint-disable-next-line no-console
  console.log(`[health] GET ${READY_PATH}   →  ${url}${READY_PATH}`);
}

// Mount your API routers under /api
app.use('/api', apiRouter);

// Static uploads (Render disk)
const uploadsDir = process.env.UPLOADS_DIR || '/var/data/uploads';
app.use(
  '/uploads',
  express.static(uploadsDir, {
    fallthrough: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  })
);

// In production, serve the client build from the API server (same origin)
if (process.env.NODE_ENV === 'production') {
  const clientDir = path.resolve(process.cwd(), 'Client', 'dist');
  app.use(express.static(clientDir, { index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}

export default app;
