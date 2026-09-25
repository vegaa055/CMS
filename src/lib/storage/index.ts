import "server-only";

import { env } from "@/env";

import { localStorageDriver } from "./local";
import { createR2Driver } from "./r2";
import type { StorageDriver } from "./types";

let driver: StorageDriver | undefined;

/** The configured storage driver (created lazily so builds don't need R2 secrets). */
export function getStorage(): StorageDriver {
  driver ??=
    env.STORAGE_DRIVER === "r2" ? createR2Driver() : localStorageDriver;
  return driver;
}

export type { StorageDriver, UploadTarget } from "./types";
