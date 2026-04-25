import { useState, useMemo, useCallback, useEffect, useRef } from "react";

export type SortDir = "asc" | "desc";
export type SortValueGetter<T> = (row: T) => string | number | boolean | Date | null | undefined;

interface SortConfig<T> {
  key: string;
  dir: SortDir;
  getValue?: SortValueGetter<T>;
}

export interface UseSortableResult<T> {
  sorted: T[];
  sortKey: string | null;
  sortDir: SortDir;
  toggleSort: (key: string, getValue?: SortValueGetter<T>) => void;
  isSorted: (key: string) => SortDir | null;
}

// Generic table sort helper.
// Pass `defaultGetter` to map `key` → field on row when no explicit getter
// is provided in toggleSort (typical case: row[key]).
export function useSortable<T extends Record<string, any>>(
  data: T[] | undefined,
  options?: {
    defaultGetter?: (row: T, key: string) => any;
    initialKey?: string;
    initialDir?: SortDir;
  },
): UseSortableResult<T> {
  const [config, setConfig] = useState<SortConfig<T> | null>(
    options?.initialKey ? { key: options.initialKey, dir: options.initialDir || "asc" } : null
  );

  const toggleSort = useCallback((key: string, getValue?: SortValueGetter<T>) => {
    setConfig(prev => {
      if (prev?.key === key) {
        if (prev.dir === "asc") return { key, dir: "desc", getValue };
        return null; // third click clears sort
      }
      return { key, dir: "asc", getValue };
    });
  }, []);

  // Callers pass `options` as an inline object on every render. Pin the only
  // field we actually care about into a stable ref so the sort doesn't recompute
  // on every parent render — recomputing a 1000+ row sort each render is what
  // was making the Contacts table feel laggy on filter/search.
  const defaultGetter = options?.defaultGetter;
  const defaultGetterRef = useRef(defaultGetter);
  useEffect(() => { defaultGetterRef.current = defaultGetter; }, [defaultGetter]);

  const sorted = useMemo(() => {
    if (!data) return [];
    if (!config) return data;
    const dg = defaultGetterRef.current;
    const get = config.getValue || ((row: T) => dg ? dg(row, config.key) : row[config.key]);
    const cmp = (a: T, b: T): number => {
      const av = get(a); const bv = get(b);
      // null/undefined go last regardless of direction
      const aNil = av === null || av === undefined || av === "";
      const bNil = bv === null || bv === undefined || bv === "";
      if (aNil && bNil) return 0;
      if (aNil) return 1;
      if (bNil) return -1;
      // Numeric compare for numbers + numeric strings
      const an = typeof av === "number" ? av : (typeof av === "string" && /^-?\d+(\.\d+)?$/.test(av) ? Number(av) : null);
      const bn = typeof bv === "number" ? bv : (typeof bv === "string" && /^-?\d+(\.\d+)?$/.test(bv) ? Number(bv) : null);
      if (an !== null && bn !== null) return an - bn;
      // Date compare
      if (av instanceof Date && bv instanceof Date) return av.getTime() - bv.getTime();
      // String compare with locale (works for Hebrew)
      const as = String(av).toLowerCase(); const bs = String(bv).toLowerCase();
      return as.localeCompare(bs, "he");
    };
    const arr = [...data].sort(cmp);
    return config.dir === "desc" ? arr.reverse() : arr;
  }, [data, config]);

  const isSorted = useCallback((key: string): SortDir | null => {
    return config?.key === key ? config.dir : null;
  }, [config]);

  return { sorted, sortKey: config?.key || null, sortDir: config?.dir || "asc", toggleSort, isSorted };
}
