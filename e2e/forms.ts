import { expect, type Locator } from "@playwright/test";

/**
 * Submit a form that has the Turnstile bot check (sign-up, password reset).
 * Its button is disabled until the check passes; clicking a disabled
 * button makes Playwright retry and scroll, which can land the click on the
 * widget instead. So wait for it to enable first.
 */
export async function submitWhenReady(button: Locator) {
  await expect(button).toBeEnabled();
  await button.click();
}
