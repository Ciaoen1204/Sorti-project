import { useCallback, useEffect, useRef, useState } from 'react';
type ProductQuery = {
  query?: string;
  category?: string;
  sort?: 'newest' | 'priceAsc' | 'priceDesc';
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
  status?: string;
};

// Platform-independent pagination, cancellation and mutation refresh.
export function useMarketPage<T extends { id: string }>(
  load: (options: ProductQuery) => Promise<T[]>,
  options: ProductQuery = {},
) {
  const key = JSON.stringify(options);
  const [value, setValue] = useState<T[]>([]);
  const [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false),
    [version, setVersion] = useState(0);
  const generation = useRef(0),
    page = useRef(0),
    locked = useRef(false);
  const fetchPage = useCallback(
    async (next: number, token: number) => {
      locked.current = true;
      setBusy(true);
      setError('');
      try {
        const rows = await load({
          ...JSON.parse(key),
          page: next,
          pageSize: 20,
        });
        if (token !== generation.current) return;
        setValue(previous =>
          Array.from(
            new Map(
              (next ? [...previous, ...rows] : rows).map(row => [row.id, row]),
            ).values(),
          ),
        );
        page.current = next;
        setHasMore(rows.length === 20);
      } catch (e) {
        if (token === generation.current)
          setError(
            e instanceof Error
              ? e.message
              : String(
                  (e as { message?: string })?.message || '無法載入，請重試。',
                ),
          );
      } finally {
        if (token === generation.current) {
          locked.current = false;
          setBusy(false);
        }
      }
    },
    [load, key],
  );
  useEffect(() => {
    const token = ++generation.current;
    page.current = 0;
    locked.current = true;
    setValue([]);
    setBusy(true);
    setError('');
    setHasMore(false);
    const timer = setTimeout(() => {
      void fetchPage(0, token);
    }, 300);
    return () => {
      clearTimeout(timer);
      generation.current = token + 1;
    };
  }, [fetchPage, version]);
  const retry = useCallback(() => {
    if (!locked.current) setVersion(v => v + 1);
  }, []);
  return {
    value,
    busy,
    error,
    hasMore,
    more: () => {
      if (!locked.current && hasMore)
        void fetchPage(page.current + 1, generation.current);
    },
    retry,
  };
}
