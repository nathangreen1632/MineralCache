export type LegalDoc = { key: string; title: string; file: string; version: string };
export type Agreement = { documentType: string; version: string; acceptedAt: string };

export async function getRequiredLegal(): Promise<LegalDoc[]> {
  const r = await fetch('/api/legal/required', { credentials: 'include' });
  const j = await r.json();
  if (!j.ok) throw new Error('failed');
  return j.docs as LegalDoc[];
}

export async function getMyAgreements(): Promise<Agreement[]> {
  const r = await fetch('/api/legal/me', { credentials: 'include' });
  const j = await r.json();
  if (!j.ok) throw new Error('failed');
  return j.agreements as Agreement[];
}

export async function postAgreement(documentType: string, version: string): Promise<void> {
  const r = await fetch('/api/legal/agree', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentType, version }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error('failed');
}
