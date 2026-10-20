import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { invoicesRoute, type InvoicesSearch } from '@/router';

export const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Owns the URL as the single source of view state, plus the one piece of local state that
 * can't live there: the search box, which is debounced so typing doesn't push a history
 * entry (and a new query key) per keystroke.
 */
export function useInvoicesSearchState() {
  const search = invoicesRoute.useSearch();
  const navigate = useNavigate({ from: invoicesRoute.fullPath });

  const setSearch = useCallback(
    (patch: Partial<InvoicesSearch>) => {
      void navigate({ search: (s) => ({ ...s, ...patch }), replace: true });
    },
    [navigate],
  );

  const urlQuery = search.q ?? '';

  // The URL can change without us typing — the back button, or a shared link — and the
  // input has to follow. Tracking which URL value the draft came from lets us reset during
  // render instead of in an effect, so there's no extra render pass.
  const [draft, setDraft] = useState({ value: urlQuery, from: urlQuery });
  if (draft.from !== urlQuery) setDraft({ value: urlQuery, from: urlQuery });

  const queryInput = draft.from === urlQuery ? draft.value : urlQuery;
  const setQueryInput = useCallback((value: string) => setDraft((d) => ({ ...d, value })), []);

  // Debounced so typing doesn't push a history entry (and a new query key) per keystroke.
  useEffect(() => {
    if (queryInput === urlQuery) return;
    const timer = setTimeout(() => {
      setSearch({ q: queryInput || undefined, page: undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryInput, urlQuery, setSearch]);

  const page = search.page ?? 1;

  return {
    search,
    setSearch,
    queryInput,
    setQueryInput,
    page,
    filter: {
      status: search.status,
      search: search.q,
      sortBy: search.sort,
      sortDir: search.dir,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
  };
}
