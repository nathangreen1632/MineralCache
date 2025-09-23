// Client/src/types/productImages.types.ts
export type ImageVariantKey = 'orig' | '320' | '800' | '1600';

export type ImageVariantMeta = {
  key: ImageVariantKey;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  url?: string | null; // optional if your API returns URLs
};

export type UploadedFileMeta = {
  name: string;
  type: string;
  size: number; // original file size (bytes)
  variants?: ImageVariantMeta[]; // optional
};

export type UploadImagesResponse = {
  ok: boolean;
  received: number;
  files: UploadedFileMeta[];
};
