/** Trim plain text to ~max characters at a word boundary, adding an ellipsis. */
export function summarize(text: string, max = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).replace(/[\s,.;:!?-]+$/, "")}…`;
}
