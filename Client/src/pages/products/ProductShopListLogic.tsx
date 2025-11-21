import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listProducts, type ListQuery, type Product } from '../../api/products';
import { searchProducts } from '../../api/search';
import type { FormState, LoadState, SortValue } from '../../types/products/ProductShopListTypes';

declare global {
  interface Window {
    __API_BASE__?: string;
  }
}

const API_BASE =
  ((import.meta?.env?.VITE_API_BASE as string | undefined)) ??
  (typeof window !== 'undefined' ? window.__API_BASE__ : undefined) ??
  '';

function trimTrailingSlashes(s: string) {
  while (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

function trimLeadingSlashes(s: string) {
  let i = 0;
  while (i < s.length && s[i] === '/') i++;
  return s.slice(i);
}

function joinUrl(base: string, path: string) {
  if (!base) return path || '';
  const b = trimTrailingSlashes(base);
  const p = trimLeadingSlashes(path || '');
  return p ? `${b}/${p}` : b;
}

type AnyImage = {
  v320Path?: string | null;
  v800Path?: string | null;
  v1600Path?: string | null;
  origPath?: string | null;
  isPrimary?: boolean | null;
  is_default_global?: boolean | null;
};

function selectImageRecord(p: any): AnyImage | null {
  if (p.primaryImage) return p.primaryImage as AnyImage;

  const arrays: AnyImage[][] = [
    p.images ?? [],
    p.photos ?? [],
    p.product_images ?? [],
    p.productImages ?? [],
  ];

  for (const arr of arrays) {
    if (Array.isArray(arr) && arr.length) {
      const pri =
        arr.find((i: AnyImage) => i?.isPrimary) ??
        arr.find((i: AnyImage) => i?.is_default_global) ??
        null;
      return pri ?? arr[0];
    }
  }
  return null;
}

export function imageUrlForCard(p: any): string | null {
  const direct =
    typeof p?.primaryImageUrl === 'string' ? p.primaryImageUrl.trim() : '';

  if (direct) {
    return joinUrl(API_BASE, direct);
  }

  const rec = selectImageRecord(p);
  if (!rec) return null;

  const rel = rec.v800Path || rec.v320Path || rec.v1600Path || rec.origPath || null;
  if (!rel) return null;

  const withPrefix =
    rel.startsWith('/') || rel.startsWith('http://') || rel.startsWith('https://')
      ? rel
      : `/uploads/${rel}`;

  return joinUrl(API_BASE, withPrefix);
}

function normalizeVendorToSlugish(input: string): string {
  const s = (input ?? '').trim().toLowerCase();
  if (!s) return '';

  const noAccents = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  return noAccents
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function isSaleActive(p: Product, now = new Date()): boolean {
  const anyP = p as any;
  if (anyP.salePriceCents == null) return false;
  const startOk = !anyP.saleStartAt || new Date(anyP.saleStartAt) <= now;
  const endOk = !anyP.saleEndAt || now <= new Date(anyP.saleEndAt);
  return startOk && endOk;
}

export function effectivePriceCents(p: Product): number {
  const anyP = p as any;
  const sale = anyP.salePriceCents;
  return isSaleActive(p) && typeof sale === 'number' ? sale : anyP.priceCents;
}

export function getVendorFromProduct(p: any): { slug: string | null; name: string | null } {
  const slug = p.vendorSlug ?? p.vendor_slug ?? p.vendor?.slug ?? null;
  const name = p.vendorName ?? p.vendor_name ?? p.vendor?.name ?? null;
  return { slug: slug ?? null, name: name ?? null };
}

function centsToDollarInput(cents?: number): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '';
  const whole = Math.trunc(cents);
  return whole % 100 === 0 ? String(whole / 100) : (whole / 100).toFixed(2);
}

function dollarsStrToCents(s: string): number | undefined {
  const t = (s || '').trim();
  if (!t) return undefined;
  const cleaned = t.replace(/[$,\s]/g, '');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}

function buildQueryFromParams(params: URLSearchParams): ListQuery {
  const pageRaw = Number(params.get('page') || 1);
  const pageSizeRaw = Number(params.get('pageSize') || 24);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 24;

  const q = params.get('q') || undefined;
  const vendorSlug = params.get('vendorSlug') || undefined;
  const species = params.get('species') || undefined;

  const onSaleParam = params.get('onSale');
  const syntheticParam = params.get('synthetic');
  const onSale = onSaleParam == null ? undefined : onSaleParam === 'true';
  const synthetic = syntheticParam == null ? undefined : syntheticParam === 'true';

  const minParam = params.get('priceMinCents');
  const maxParam = params.get('priceMaxCents');
  const priceMinCents =
    minParam != null && minParam !== '' ? Math.max(0, Math.trunc(+minParam)) : undefined;
  const priceMaxCents =
    maxParam != null && maxParam !== '' ? Math.max(0, Math.trunc(+maxParam)) : undefined;

  const sort = (params.get('sort') as ListQuery['sort']) || 'newest';

  return {
    page,
    pageSize,
    q,
    vendorSlug,
    species,
    onSale,
    synthetic,
    priceMinCents,
    priceMaxCents,
    sort,
  };
}

function initialFormFromQuery(query: ListQuery): FormState {
  return {
    species: query.species ?? '',
    vendorSlug: query.vendorSlug ?? '',
    onSale: Boolean(query.onSale),
    synthetic: Boolean(query.synthetic),
    priceMinDollars: centsToDollarInput(query.priceMinCents),
    priceMaxDollars: centsToDollarInput(query.priceMaxCents),
    sort: (query.sort ?? 'newest') as SortValue,
    pageSize: String(query.pageSize ?? 24),
  };
}

export function useProductShopListController() {
  const [params, setParams] = useSearchParams();
  const paramsRef = useRef(params);

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [inputQ, setInputQ] = useState<string>(params.get('q') ?? '');

  const [query, setQuery] = useState<ListQuery>(() => buildQueryFromParams(params));
  const [form, setForm] = useState<FormState>(() =>
    initialFormFromQuery(buildQueryFromParams(params)),
  );

  useEffect(() => {
    const nextQuery = buildQueryFromParams(params);
    setQuery(nextQuery);
    setForm(initialFormFromQuery(nextQuery));
    setInputQ(params.get('q') ?? '');
  }, [params]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setState({ kind: 'loading' });

      const qTerm = (query.q ?? '').trim();

      try {
        const resp = qTerm
          ? await searchProducts({
            q: qTerm,
            page: query.page,
            pageSize: query.pageSize,
            sort: query.sort,
            vendorSlug: query.vendorSlug,
          })
          : await listProducts(query);

        if (!alive) return;

        const { data, error, status } = resp;
        if (error || !data) {
          setState({ kind: 'error', message: error || `Failed (${status})` });
          return;
        }

        setState({
          kind: 'loaded',
          data: {
            items: data.items,
            total: data.total,
            page: data.page,
            totalPages: data.totalPages,
          },
        });
      } catch (e: any) {
        if (!alive) return;
        setState({ kind: 'error', message: e?.message || 'Failed to load products' });
      }
    })();

    return () => {
      alive = false;
    };
  }, [query]);

  function updateQuery(partial: Partial<ListQuery>) {
    const base = paramsRef.current;
    const next = new URLSearchParams(base);
    for (const [k, v] of Object.entries(partial)) {
      if (v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    if (!('page' in partial)) next.set('page', '1');
    setParams(next, { replace: true });
  }

  function submitFilters(e: FormEvent) {
    e.preventDefault();

    const minCents = dollarsStrToCents(form.priceMinDollars);
    const maxCents = dollarsStrToCents(form.priceMaxDollars);
    const trimmedQ = inputQ.trim();

    updateQuery({
      q: trimmedQ || undefined,
      species: form.species.trim() || undefined,
      vendorSlug: normalizeVendorToSlugish(form.vendorSlug) || undefined,
      onSale: form.onSale || undefined,
      synthetic: form.synthetic || undefined,
      priceMinCents: minCents,
      priceMaxCents: maxCents,
      sort: form.sort as ListQuery['sort'],
      pageSize: Math.max(1, Math.trunc(+form.pageSize)) || 24,
    });
  }

  function goToPage(p: number) {
    const nextPage = Math.max(1, p);
    updateQuery({ page: nextPage });
  }

  const skeletonKeys = useMemo(() => Array.from({ length: 9 }, (_, i) => `sk-${i}`), []);
  const qStr = query.q ?? '';

  return {
    state,
    filtersOpen,
    setFiltersOpen,
    inputQ,
    setInputQ,
    form,
    setForm,
    submitFilters,
    goToPage,
    skeletonKeys,
    qStr,
  };
}
