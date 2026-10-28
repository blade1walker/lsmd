"use client";

import { useEffect } from "react";

/**
 * Blocks the ordinary ways of lifting text off the page: selection, copy, cut,
 * right-click, drag-out, and print.
 *
 * Deterrence, not secrecy — anything a browser renders can still be read from
 * devtools or photographed. This exists because the SOP is marked "not for
 * distribution outside Nexus EMS", so casual copy-paste sharing should take
 * deliberate effort rather than one keystroke.
 *
 * Only wraps the reading surface. The admin editor is deliberately left alone,
 * since writing a document there needs copy and paste to work normally.
 */
export function CopyGuard({ children }: { children: React.ReactNode }) {
  // Bound to the document rather than the wrapper: a copy event fires at the
  // selection, which may sit outside this subtree, and these listeners only
  // exist while a guarded page is mounted.
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();

    // Ctrl/Cmd + C, X, A, S, P, U — copy, cut, select-all, save, print, source.
    const blockShortcuts = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (["c", "x", "a", "s", "p", "u"].includes(e.key.toLowerCase())) e.preventDefault();
    };

    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("keydown", blockShortcuts);

    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("keydown", blockShortcuts);
    };
  }, []);

  return (
    <div data-copy-guard className="select-none [-webkit-touch-callout:none]">
      <style>{`
        [data-copy-guard], [data-copy-guard] * {
          -webkit-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }
        [data-copy-guard] ::selection { background: transparent; }
        @media print {
          [data-copy-guard] { display: none !important; }
          body::after {
            content: "Nexus EMS — internal document. Printing is disabled.";
            display: block;
            padding: 2rem;
            font-family: sans-serif;
          }
        }
      `}</style>
      {children}
    </div>
  );
}
