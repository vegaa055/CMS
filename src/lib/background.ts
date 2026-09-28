import "server-only";

import { after } from "next/server";

/**
 * Let an already-started task finish after the response is sent. `after()`
 * keeps a serverless function alive until it settles. Outside a request
 * (scripts, tests) there's nothing to defer, and the task just runs on.
 */
export function runAfterResponse(task: Promise<unknown>) {
  try {
    after(() => task);
  } catch {
    // Not in a request scope.
  }
}
