/**
 * Transactional email templates: table layout with inline styles (what email
 * clients reliably render) plus a plain-text version of each. Every value
 * that goes into the HTML is escaped. Colors are literal hex because email
 * clients don't support CSS variables; the button uses the brand primary
 * (see src/lib/og.tsx). Light design, since dark emails render unreliably.
 */

const COLORS = {
  page: "#f4f5f7",
  card: "#ffffff",
  text: "#0f1116",
  muted: "#5b616e",
  border: "#e4e6eb",
  button: "#57d6c4",
  buttonText: "#0f1116",
};

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

export type EmailContent = { subject: string; html: string; text: string };

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

/** "an editor", "an admin", "an author" */
export function withArticle(noun: string) {
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

type Layout = {
  siteName: string;
  subject: string;
  /** Inbox preview line. */
  preview: string;
  heading: string;
  paragraphs: string[];
  action: { label: string; url: string };
  /** Small print: expiry and what to do if it wasn't them. */
  footnote: string;
};

function render(layout: Layout): EmailContent {
  const { siteName, subject, preview, heading, paragraphs, action, footnote } =
    layout;
  const e = escapeHtml;
  const url = e(action.url);
  const text = (size: number, color: string, extra = "") =>
    `margin:0 0 16px;font-family:${SANS};font-size:${size}px;line-height:1.6;color:${color};${extra}`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr><td style="padding:0 4px 16px;font-family:${SERIF};font-size:22px;line-height:1.2;color:${COLORS.text};">${e(siteName)}</td></tr>
<tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;padding:32px;">
<h1 style="margin:0 0 16px;font-family:${SANS};font-size:22px;line-height:1.3;font-weight:600;color:${COLORS.text};">${e(heading)}</h1>
${paragraphs.map((p) => `<p style="${text(15, COLORS.text)}">${e(p)}</p>`).join("\n")}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr><td style="border-radius:8px;background:${COLORS.button};">
<a href="${url}" style="display:inline-block;padding:12px 20px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;color:${COLORS.buttonText};text-decoration:none;border-radius:8px;">${e(action.label)}</a>
</td></tr>
</table>
<p style="${text(13, COLORS.muted, "margin-bottom:4px;")}">If the button doesn't work, paste this link into your browser:</p>
<p style="${text(13, COLORS.text, "word-break:break-all;")}"><a href="${url}" style="color:${COLORS.text};">${url}</a></p>
<p style="${text(13, COLORS.muted, "margin:0;")}">${e(footnote)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const plain = [
    heading,
    ...paragraphs,
    `${action.label}: ${action.url}`,
    footnote,
    `— ${siteName}`,
  ].join("\n\n");

  return { subject, html, text: plain };
}

export function verifyEmailMessage({
  siteName,
  name,
  url,
}: {
  siteName: string;
  name: string;
  url: string;
}) {
  return render({
    siteName,
    subject: `Confirm your email for ${siteName}`,
    preview: "Confirm your email address to finish setting up your account.",
    heading: "Confirm your email",
    paragraphs: [
      `Hi ${name}, thanks for joining ${siteName}.`,
      "Confirm this is your email address to finish setting up your account.",
    ],
    action: { label: "Confirm email", url },
    footnote:
      "This link expires in 24 hours. If you didn't create an account, you can ignore this email.",
  });
}

export function resetPasswordMessage({
  siteName,
  name,
  url,
}: {
  siteName: string;
  name: string;
  url: string;
}) {
  return render({
    siteName,
    subject: `Reset your ${siteName} password`,
    preview: "Use this link to choose a new password.",
    heading: "Reset your password",
    paragraphs: [
      `Hi ${name}, we got a request to reset the password for your ${siteName} account.`,
      "Choose a new password with the button below. You'll be signed out on your other devices.",
    ],
    action: { label: "Choose a new password", url },
    footnote:
      "This link expires in 1 hour. If you didn't ask to reset your password, ignore this email; it won't change.",
  });
}

export function inviteMessage({
  siteName,
  inviterName,
  role,
  url,
  days,
}: {
  siteName: string;
  inviterName: string;
  /** Lowercase role name, e.g. "editor". */
  role: string;
  url: string;
  days: number;
}) {
  return render({
    siteName,
    subject: `${inviterName} invited you to ${siteName}`,
    preview: `Join ${siteName} as ${withArticle(role)}.`,
    heading: `Join ${siteName}`,
    paragraphs: [
      `${inviterName} invited you to join ${siteName} as ${withArticle(role)}.`,
      "Accept the invitation to choose your name and password.",
    ],
    action: { label: "Accept invitation", url },
    footnote: `This link works once and expires in ${days} days. If you weren't expecting it, you can ignore this email.`,
  });
}

/** Step 1 of an email change: sent to the current address. */
export function emailChangeConfirmationMessage({
  siteName,
  name,
  newEmail,
  url,
}: {
  siteName: string;
  name: string;
  newEmail: string;
  url: string;
}) {
  return render({
    siteName,
    subject: `Confirm your new email for ${siteName}`,
    preview: `Confirm changing your email to ${newEmail}.`,
    heading: "Confirm your email change",
    paragraphs: [
      `Hi ${name}, you asked to change the email for your ${siteName} account to ${newEmail}.`,
      "Confirm it here, then open the link we send to the new address to finish.",
    ],
    action: { label: "Confirm the change", url },
    footnote:
      "This link expires in 24 hours. If you didn't ask for this, ignore this email; nothing changes. Consider changing your password.",
  });
}

/** Step 2 of an email change: sent to the new address. */
export function newEmailMessage({
  siteName,
  name,
  url,
}: {
  siteName: string;
  name: string;
  url: string;
}) {
  return render({
    siteName,
    subject: `Verify your new email for ${siteName}`,
    preview: "One click to start using this address.",
    heading: "Verify your new email",
    paragraphs: [
      `Hi ${name}, confirm this is the new email address for your ${siteName} account.`,
      "Until you do, we'll keep using your old one.",
    ],
    action: { label: "Use this email", url },
    footnote:
      "This link expires in 24 hours. If you didn't ask for this, you can ignore this email.",
  });
}
