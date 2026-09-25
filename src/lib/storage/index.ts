import "server-only";

import { env } from "@/env";

import { localStorageDriver } from "./local";
import { createR2Driver } from "./r2";
import type { StorageDriver } from "./types";

let driver: StorageDriver | undefined;

/** The configured storage driver (created lazily so builds don't need R2 secrets). */
export function getStorage(): StorageDriver {
  if (env.STORAGE_DRIVER === "local" && process.env.VERCEL) {
    // Serverless filesystems are read-only/ephemeral; uploads would vanish.
    throw new Error(
      "STORAGE_DRIVER=local can't be used on Vercel. Configure R2.",
    );
  }
  driver ??=
    env.STORAGE_DRIVER === "r2" ? createR2Driver() : localStorageDriver;
  return driver;
}

export type { StorageDriver, UploadTarget } from "./types";
