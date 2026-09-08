"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Fires a single Google Analytics 4 event the moment this component mounts
 * — for marking a page load as a conversion (e.g. signup succeeding)
 * without turning the whole page into a client component just for this one
 * side-effect. Renders nothing.
 *
 * Guards against firing twice: once via a ref (React can mount a component
 * twice in development under Strict Mode), and once via sessionStorage (so
 * reloading or navigating back to the same page in one browser tab doesn't
 * count as a second conversion).
 *
 * IMPORTANT: firing the event here is only half the setup. For it to show
 * up in GA4's "Key events" count, this event name also has to be marked as
 * a Key Event in the GA4 property itself — Admin -> Events -> find it in
 * the list -> toggle "Mark as key event". GA only lists an event once it
 * has actually fired at least once, so that step has to happen after this
 * has run in production for real (e.g. after one real or test signup).
 */
export default function GaEvent({ name, params }: { name: string; params?: Record<string, unknown> }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const dedupeKey = `ga_event_once:${name}`;
    try {
      if (sessionStorage.getItem(dedupeKey)) return;
      sessionStorage.setItem(dedupeKey, "1");
    } catch {
      // sessionStorage can throw in some locked-down browser contexts
      // (private browsing, disabled storage) — fall through and fire
      // anyway rather than silently losing the event.
    }

    window.gtag?.("event", name, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  return null;
}
