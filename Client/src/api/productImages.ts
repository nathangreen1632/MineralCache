// Client/src/api/productImages.ts
import type {UploadImagesResponse} from '../types/productImages.types';

export async function uploadProductImages(
  productId: number,
  files: File[],
): Promise<UploadImagesResponse> {
  const form = new FormData();
  for (const f of files) form.append('photos', f);

  const res = await fetch(`/api/products/${productId}/images`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  // Basic graceful errors
  if (!res.ok) {
    const text = await res.text().catch(() => 'Upload failed');
    throw new Error(text || `HTTP ${res.status}`);
  }

  return (await res.json()) as UploadImagesResponse;
}
