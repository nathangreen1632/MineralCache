// Server/src/models/sequelize.ts
import { Sequelize } from 'sequelize';

let _sequelize: Sequelize | null = null;

function buildSequelize(url: string): Sequelize {
  const raw = process.env.DB_SSL;
  let useSsl: boolean;

  if (raw === 'true') {
    useSsl = true;
  } else if (raw === 'false') {
    useSsl = false;
  } else {
    useSsl = process.env.NODE_ENV === 'production';
  }

  return new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: useSsl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    pool: { max: 10, min: 0, idle: 10_000 },
  });
}

export const db = {
  get isConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL);
  },

  instance(): Sequelize | null {
    if (!this.isConfigured) return null;
    _sequelize ??= buildSequelize(process.env.DATABASE_URL as string);
    return _sequelize;
  },

  async ping(): Promise<{ ok: boolean; error?: string }> {
    const s = this.instance();
    if (!s) return { ok: false, error: 'DATABASE_URL not set' };
    try {
      await s.authenticate();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'DB auth failed' };
    }
  },
};
