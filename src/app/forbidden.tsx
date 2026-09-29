import { ForbiddenMessage } from "@/components/auth/forbidden-message";

/**
 * Next renders this with every route (as the fallback for `forbidden()`),
 * so it must not read the request: doing so made every page dynamic.
 */
export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground font-mono text-sm">403</p>
      <h1 className="font-display text-4xl">You don&apos;t have access</h1>
      <ForbiddenMessage />
    </main>
  );
}
