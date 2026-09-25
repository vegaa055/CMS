type PgErrorFields = { code?: string; constraint?: string };

/**
 * Postgres error fields from a thrown query error. Drizzle wraps driver
 * errors (DrizzleQueryError), so the pg fields live on `cause`.
 */
export function pgError(error: unknown): PgErrorFields {
  const e = error as PgErrorFields & { cause?: PgErrorFields };
  return {
    code: e?.code ?? e?.cause?.code,
    constraint: e?.constraint ?? e?.cause?.constraint,
  };
}

export const UNIQUE_VIOLATION = "23505";
