/** Allowed link targets: http(s), mailto, same-site paths, and anchors. */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string" || !href) return false;
  if (href.startsWith("#")) return true;
  if (href.startsWith("/")) return !href.startsWith("//");
  try {
    return ["http:", "https:", "mailto:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

/** Turn user input like "example.com" into "https://example.com". */
export function normalizeHref(input: string) {
  const value = input.trim();
  if (!value || /^(https?:|mailto:|\/|#)/i.test(value)) return value;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  return `https://${value}`;
}
