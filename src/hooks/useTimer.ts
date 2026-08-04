"use client";

import { useEffect, useState } from "react";

// Ticks purely client-side off the server-provided started_at — no polling,
// and a page reload resyncs from the same field. Elapsed time is derived
// from a ticking clock rather than stored directly, so changing startedAt
// needs no state reset.
export function useTimer(startedAt: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
}
