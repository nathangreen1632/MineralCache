import fs from 'node:fs/promises';
import path from 'node:path';
import type { StorageAdapter, PutResult } from './StorageAdapter.storage.js';

export class DiskAdapter implements StorageAdapter {
  constructor(private readonly baseDir: string, private readonly publicBase = '/uploads') {}
  async put(relPath: string, bytes: Buffer): Promise<PutResult> {
    const abs = path.join(this.baseDir, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, bytes);
    return { url: this.getUrl(relPath), relPath };
  }
  async delete(relPath: string) {
    await fs.rm(path.join(this.baseDir, relPath), { force: true });
  }
  getUrl(relPath: string) {
    return `${this.publicBase}/${relPath}`.replace(/\\/g, '/');
  }
}
