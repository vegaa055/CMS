"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

type TurnstileApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: "light" | "dark";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoad: Promise<void> | undefined;

function loadScript() {
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoad = undefined; // allow a retry
      reject(new Error("Couldn't load the bot check."));
    };
    document.head.append(script);
  });
  return scriptLoad;
}

/**
 * Cloudflare Turnstile widget. Reports a token when the check passes and
 * null when it expires or fails. Tokens work once: remount it (change its
 * `key`) after a rejected submission to get a new one.
 */
export function Turnstile({
  siteKey,
  action,
  onToken,
}: {
  siteKey: string;
  /** Shown in Cloudflare's analytics, e.g. "sign-up". */
  action: string;
  onToken: (token: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const report = useEffectEvent(onToken);

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          // Read the theme class (set before paint) once instead of
          // following next-themes: re-rendering the widget when the theme
          // resolves shifted the form under the pointer mid-click.
          theme: document.documentElement.classList.contains("light")
            ? "light"
            : "dark",
          callback: (token) => report(token),
          "expired-callback": () => report(null),
          "error-callback": () => report(null),
        });
      })
      .catch(() => report(null));
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, action]);

  // Reserve the widget's height (72px as rendered today; the docs say 65)
  // so the form doesn't shift when it appears.
  return <div ref={container} className="min-h-[72px]" />;
}

/**
 * Turnstile state for a form. With no site key there's no check: `ready`
 * is true and nothing renders. Send `headers` with the request, and call
 * `reset()` after a rejected submission (the token has been used).
 */
export function useCaptcha(siteKey: string | undefined, action: string) {
  const [token, setToken] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  return {
    ready: !siteKey || token !== null,
    headers: token ? { "x-captcha-response": token } : undefined,
    reset() {
      setToken(null);
      setAttempt((n) => n + 1);
    },
    widget: siteKey ? (
      <Turnstile
        key={attempt}
        siteKey={siteKey}
        action={action}
        onToken={setToken}
      />
    ) : null,
  };
}
