// Client/src/api/health.ts
import { get } from '../lib/api';

export type HealthRes = {
  ok: boolean;
  ts: string;
  stripe: { enabled: boolean; ready: boolean; missing: string[] };
};

export function getHealth() {
  return get<HealthRes>('/health');
}
