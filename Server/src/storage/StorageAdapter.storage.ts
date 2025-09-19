export interface PutResult { url: string; relPath: string; }
export interface StorageAdapter {
  put(filePath: string, bytes: Buffer): Promise<PutResult>;
  delete(relPath: string): Promise<void>;
  getUrl(relPath: string): string;
}
