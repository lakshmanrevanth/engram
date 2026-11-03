'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { hasSortParams, parseTableState, serializeTableState, type SortOrder, type TableState } from './filters';

const SORT_KEY = 'recall_sort_config';

/** Table view state, mirrored to the URL (router.replace, debounced) so views can be shared. */
export function useTableUrlState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<TableState>(() => parseTableState(searchParams));

  // No sort in the URL → fall back to the saved localStorage preference.
  useEffect(() => {
    if (hasSortParams(searchParams)) return;
    try {
      const saved = JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null');
      if (saved?.sortBy || saved?.sortOrder) {
        // Read after hydration on purpose: localStorage isn't available during SSR.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState((s) => ({
          ...s,
          sort: typeof saved.sortBy === 'string' ? saved.sortBy : s.sort,
          order: saved.sortOrder === 'desc' || saved.sortOrder === 'asc' ? (saved.sortOrder as SortOrder) : s.order,
        }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQs = useRef(serializeTableState(state));
  useEffect(() => {
    const qs = serializeTableState(state);
    if (qs === lastQs.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastQs.current = qs;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, router, pathname]);

  const update = useCallback((patch: Partial<TableState> | ((s: TableState) => TableState)) => {
    setState((s) => {
      const next = typeof patch === 'function' ? patch(s) : { ...s, ...patch };
      if (next.sort !== s.sort || next.order !== s.order) {
        try {
          localStorage.setItem(SORT_KEY, JSON.stringify({ sortBy: next.sort, sortOrder: next.order }));
        } catch {}
      }
      return next;
    });
  }, []);

  return [state, update] as const;
}
