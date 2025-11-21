// Server/src/app.ts
import express, { Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import apiRouter from './routes/index.js';
import { db } from './models/sequelize.js';
import './models/associations.js';
import 'dotenv/config';
import { buildSessionMiddleware } from './middleware/session.middleware.js';
import { attachUser } from './middleware/authz.middleware.js';
import { requestId } from './middleware/requestId.middleware.js';
import { requestContext } from './middleware/requestContext.middleware.js';
import { jsonErrorHandler } from './middleware/error.middleware.js';
import { getVersionInfo } from './utils/version.util.js';
import { assertStripeAtBoot, getStripeStatus } from './services/stripe.service.js';
import webhooksRouter from './routes/webhooks.route.js';
import { registerUploadsStatic } from './middleware/uploadsStatic.js';
import { publicRouter } from './routes/public.routes.js';
import { initializePayoutsScheduler } from './jobs/payouts.job.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const CLIENT_DIST_DIR = path.join(ROOT_DIR, 'Client', 'dist');

assertStripeAtBoot();

const app: Express = express();

app.set('trust proxy', true);

app.use('/api/webhooks', webhooksRouter);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': [
          "'self'",
          'data:',
          'https://www.gravatar.com',
          'https://secure.gravatar.com',
        ],
      },
    },
  }),
);

app.use(compression());
app.use(morgan('tiny'));

app.use(requestId);

app.use(buildSessionMiddleware());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(attachUser);

app.use(requestContext);

const HEALTH_PATH = '/api/health';
const READY_PATH = '/api/ready';
const VERSION_PATH = '/api/version';

app.get(HEALTH_PATH, (_req, res) =>
  res.json({
    ok: true,
    ts: new Date().toISOString(),
    stripe: getStripeStatus(),
  }),
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

app.get(VERSION_PATH, (_req, res) => {
  const v = getVersionInfo();
  res.json({
    ok: true,
    sha: v.short ?? null,
    fullSha: v.sha,
    source: v.source,
    buildTime: v.buildTime,
  });
});

if (process.env.NODE_ENV !== 'production') {
  const port = Number(process.env.PORT || 3001);
  const url = `http://localhost:${port}`;
  console.log(`[health]  GET ${HEALTH_PATH}   →  ${url}${HEALTH_PATH}`);
  console.log(`[health]  GET ${READY_PATH}    →  ${url}${READY_PATH}`);
  console.log(`[version] GET ${VERSION_PATH}  →  ${url}${VERSION_PATH}`);
}

await registerUploadsStatic(app);

app.use('/api/public', publicRouter);

app.use('/api', apiRouter);

initializePayoutsScheduler();

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(CLIENT_DIST_DIR, { index: false }));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  });

  app.get('/*splat', (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  });
}

app.use(jsonErrorHandler);

export default app;
