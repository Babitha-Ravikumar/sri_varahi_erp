/**
 * Reference data (purchase sources, payment methods, bill statuses)
 * loaded from GET /reference. The app keeps no copy of these master lists.
 */
import { useEffect, useState } from 'react';
import { get } from './api';

let cache = null;
let pending = null;

export function loadReference({ refresh = false } = {}) {
  if (cache && !refresh) return Promise.resolve(cache);
  if (!pending || refresh) {
    pending = get('/reference')
      .then((data) => { cache = data || {}; return cache; })
      .finally(() => { pending = null; });
  }
  return pending;
}

/** Reference rows ({ code, label, description, icon, selectable }) of one category. */
export function useReference(category) {
  const [rows, setRows] = useState(() => (cache && cache[category]) || []);
  useEffect(() => {
    let alive = true;
    loadReference()
      .then((data) => { if (alive) setRows(data[category] || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [category]);
  return rows;
}

/** Display label of a code, falling back to the code itself. */
export function refLabel(rows, code) {
  const row = rows.find((r) => r.code === code);
  return row ? row.label : String(code || '').replace(/_/g, ' ');
}
