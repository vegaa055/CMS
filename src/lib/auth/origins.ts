/** An origin plus its apex/www twin (example.com <-> www.example.com). */
export function withWwwVariant(origin: string) {
  const url = new URL(origin);
  const twin = url.hostname.startsWith("www.")
    ? url.hostname.slice(4)
    : `www.${url.hostname}`;
  return [
    url.origin,
    `${url.protocol}//${twin}${url.port ? `:${url.port}` : ""}`,
  ];
}
