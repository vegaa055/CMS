/**
 * Domains that can never receive mail (RFC 2606 / RFC 6761), used by tests
 * and seed data. Mail to them is kept in the local outbox instead of being
 * sent, so test runs can't bounce off Resend and hurt the sender's reputation.
 */
const RESERVED_TLDS = ["local", "localhost", "test", "example", "invalid"];
const RESERVED_DOMAINS = ["example.com", "example.net", "example.org"];

export function isDeliverableAddress(email: string) {
  const domain = email.split("@").pop()?.toLowerCase() ?? "";
  if (!domain || !domain.includes(".")) return false;
  const tld = domain.split(".").pop()!;
  return !(
    RESERVED_TLDS.includes(tld) ||
    RESERVED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
  );
}

/**
 * `Site Name <address>`. Characters that could break the header are
 * removed; the name is quoted only if it has characters that are special in
 * address headers (e.g. "Notes: Vol. 2").
 */
export function fromHeader(name: string, address: string) {
  const safe = name.replace(/["\\\r\n<>]/g, "").trim();
  if (!safe) return address;
  return /[()[\]:;@,.]/.test(safe)
    ? `"${safe}" <${address}>`
    : `${safe} <${address}>`;
}
