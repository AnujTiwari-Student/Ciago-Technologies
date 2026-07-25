import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicConfig } from "@/lib/publicConfig.functions";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "auto" | "light" | "dark";
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

/**
 * Cloudflare Turnstile widget. Calls `onToken` with a fresh token whenever
 * the challenge succeeds; also emits an empty string on expiry so the parent
 * can disable submit until it re-solves.
 * Renders nothing when TURNSTILE_SITE_KEY is not configured (dev fallback).
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const fetchConfig = useServerFn(getPublicConfig);
  const { data: config } = useQuery({
    queryKey: ["public-config"],
    queryFn: () => fetchConfig(),
    staleTime: 60 * 60 * 1000,
  });
  const siteKey = config?.turnstileSiteKey;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!siteKey) return;
    if (window.turnstile) {
      setScriptReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-turnstile="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => setScriptReady(true), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.dataset.turnstile = "true";
    s.onload = () => setScriptReady(true);
    document.head.appendChild(s);
  }, [siteKey]);

  useEffect(() => {
    if (!scriptReady || !siteKey || !hostRef.current || widgetIdRef.current) return;
    try {
      widgetIdRef.current = window.turnstile!.render(hostRef.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    } catch (err) {
      console.error("[turnstile] render failed", err);
    }
    return () => {
      if (widgetIdRef.current) {
        try {
          window.turnstile?.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [scriptReady, siteKey, onToken]);

  if (!siteKey) return null;
  return <div ref={hostRef} className="cf-turnstile" />;
}
