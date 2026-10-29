"use client";

import { useEffect } from "react";

/**
 * Runs a page's data loader when the page opens, and again whenever the loader
 * changes (its useCallback dependencies, e.g. a filter or page number) or
 * `enabled` turns true (e.g. once the session is known).
 *
 * `load` must be memoized with useCallback, and should set state only after
 * its first await — the loaders here start from their initial state, so
 * opening a page never renders twice in a row. (The hooks linter cannot see
 * past an await and would flag every loader called straight from useEffect.)
 */
export function useLoad(load: () => Promise<unknown>, enabled = true) {
  useEffect(() => {
    if (enabled) void load();
  }, [load, enabled]);
}
