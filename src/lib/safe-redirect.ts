/** Only allow same-origin relative paths as post-login redirects (prevents open redirects). */
export function safeRedirectPath(
  value: string | string[] | undefined,
  fallback = "/admin",
) {
  const path = Array.isArray(value) ? value[0] : value;
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/\\")
  ) {
    return fallback;
  }
  return path;
}
