"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/**
 * Cloudflare Turnstile widget for a plain <form action={serverAction}>.
 * Renders itself explicitly (rather than relying on Turnstile's automatic
 * div-scan) so it reliably reappears after a Next.js server-action redirect
 * back to the same page — and writes the verification token into a hidden
 * input named "cf-turnstile-response" that the surrounding <form> submits
 * like any other field. No client-side submit handling needed.
 *
 * Renders nothing if siteKey is empty, so this is a no-op until
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is set — safe to ship ahead of turning the
 * Cloudflare/Supabase side on.
 */
export default function Turnstile({ siteKey }: { siteKey: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    function renderWidget() {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          if (inputRef.current) inputRef.current.value = token;
        },
        "expired-callback": () => {
          if (inputRef.current) inputRef.current.value = "";
        },
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget, { once: true });
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          // Widget's container may already be gone — safe to ignore.
        }
      }
    };
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div className="field">
      <div ref={containerRef} />
      <input ref={inputRef} type="hidden" name="cf-turnstile-response" />
    </div>
  );
}
