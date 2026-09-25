import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/env";

import * as schema from "./schema";

/**
 * Drizzle client over Neon's HTTP driver: no connection pool to manage, which
 * suits serverless functions. Use `db.batch([...])` for atomic multi-statement writes.
 */
export const db = drizzle(neon(env.DATABASE_URL), { schema });

export type DB = typeof db;
