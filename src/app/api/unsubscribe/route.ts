import { readToken, setNotification } from "@/lib/notifications";

/**
 * One-click unsubscribe (RFC 8058): mail clients POST here from the
 * List-Unsubscribe header. The token names the person and the kind of email.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const target = token && token.length < 500 ? readToken(token) : null;
  if (!target) return new Response("Invalid link", { status: 400 });
  await setNotification(target.userId, target.kind, false);
  return new Response("Unsubscribed", { status: 200 });
}

/** A plain visit (not a mail client) gets the page with a button instead. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  return Response.redirect(new URL(`/unsubscribe${url.search}`, url), 303);
}
