import { AdminSettings } from '../models/adminSettings.model.js';

let cached: any | null = null;
let cachedAt = 0;

export async function getAdminSettingsCached(ttlMs = 10_000) {
  const now = Date.now();
  if (cached && now - cachedAt < ttlMs) return cached;
  const row = await AdminSettings.findByPk(1).catch(() => null);
  cached = row ? row.toJSON() : {};
  cachedAt = now;
  return cached;
}
