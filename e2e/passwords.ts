/**
 * A fresh password per test. Passwords are checked against known data
 * breaches on sign-up and reset, so fixed test strings could be rejected.
 */
export function randomPassword() {
  return `e2e-${crypto.randomUUID()}`;
}
