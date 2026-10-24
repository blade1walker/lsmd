"use client";

import { useEffect, useRef } from "react";

export type LeaveReason = "switched tab or app" | "left the window" | "exited full screen";

/**
 * Exam mode for a test in progress: copying, cutting, pasting, right-click,
 * dragging and the usual shortcuts are blocked, and leaving the page — another
 * tab, another app, exiting full screen — is reported through `onLeave`.
 *
 * Like CopyGuard, this is deterrence rather than a lock: a browser cannot stop
 * a second device or devtools. What makes it stick is that the page reports
 * every leave to the server, which counts them and hands the test in.
 */
export function ExamGuard({
  active,
  onLeave,
  children,
}: {
  active: boolean;
  onLeave: (reason: LeaveReason) => void;
  children: React.ReactNode;
}) {
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onLeaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    if (!active) return;
    const block = (e: Event) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "v", "a", "s", "p", "u", "f"].includes(k)) e.preventDefault();
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k))) e.preventDefault();
    };

    // Blur and visibilitychange both fire when switching tabs, so leaves
    // within a second of each other count once.
    let last = 0;
    const leave = (reason: LeaveReason) => {
      const now = Date.now();
      if (now - last < 1000) return;
      last = now;
      onLeaveRef.current(reason);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") leave("switched tab or app");
    };
    // A dropdown's popup can take focus from the window in some browsers; a
    // real switch away from it is still caught by visibilitychange.
    const onBlur = () => {
      if (document.activeElement?.tagName === "SELECT") return;
      leave("left the window");
    };
    let wasFullscreen = !!document.fullscreenElement;
    const onFullscreen = () => {
      if (wasFullscreen && !document.fullscreenElement) leave("exited full screen");
      wasFullscreen = !!document.fullscreenElement;
    };

    const events = ["copy", "cut", "paste", "contextmenu", "dragstart", "drop"] as const;
    events.forEach((ev) => document.addEventListener(ev, block));
    document.addEventListener("keydown", blockKeys);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("blur", onBlur);
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, block));
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("blur", onBlur);
    };
  }, [active]);

  if (!active) return <>{children}</>;
  return (
    <div data-exam-guard>
      <style>{`
        [data-exam-guard], [data-exam-guard] * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
        [data-exam-guard] input, [data-exam-guard] textarea { -webkit-user-select: text; user-select: text; }
        @media print { [data-exam-guard] { display: none !important; } }
      `}</style>
      {children}
    </div>
  );
}

/** Best effort — browsers only allow it from a click, and some (iOS Safari) not at all. */
export function enterFullscreen() {
  if (typeof document === "undefined" || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().catch(() => {});
}
