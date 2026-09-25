import "server-only";

import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { media, posts, user } from "@/db/schema";
import { canManageMedia } from "@/lib/auth/permissions";
import type { AppSession } from "@/lib/auth/session";
import type { MediaItem, MediaPage } from "@/lib/media/types";

export const MEDIA_PAGE_SIZE = 48;

const mediaColumns = {
  id: media.id,
  key: media.key,
  url: media.url,
  filename: media.filename,
  mimeType: media.mimeType,
  size: media.size,
  width: media.width,
  height: media.height,
  alt: media.alt,
  createdAt: media.createdAt,
  uploadedById: media.uploadedById,
  uploaderName: user.name,
};

type MediaRecord = {
  id: string;
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  createdAt: Date;
  uploadedById: string | null;
  uploaderName: string | null;
};

export function toMediaItem(row: MediaRecord, session: AppSession): MediaItem {
  return {
    id: row.id,
    key: row.key,
    url: row.url,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    createdAt: row.createdAt.toISOString(),
    uploadedBy:
      row.uploadedById && row.uploaderName
        ? { id: row.uploadedById, name: row.uploaderName }
        : null,
    canManage: canManageMedia(session.user, row),
  };
}

/**
 * Cursor = "<created_at as Postgres text>|<id>" of the previous page's last
 * row. The timestamp stays a string end to end: JS Dates drop Postgres'
 * microseconds, which would skip rows created in the same millisecond.
 */
function parseCursor(cursor: string | null | undefined) {
  if (!cursor) return undefined;
  const [ts, id] = cursor.split("|");
  if (!ts || !id || !/^[0-9a-f-]{36}$/.test(id)) return undefined;
  return or(
    sql`${media.createdAt} < ${ts}::timestamptz`,
    and(sql`${media.createdAt} = ${ts}::timestamptz`, lt(media.id, id)),
  );
}

/** Newest-first media, optionally filtered by filename/alt text. */
export async function listMedia(
  session: AppSession,
  { q, cursor }: { q?: string | null; cursor?: string | null } = {},
): Promise<MediaPage> {
  const search = q?.trim();
  const rows = await db
    .select({
      ...mediaColumns,
      cursorTs: sql<string>`${media.createdAt}::text`,
    })
    .from(media)
    .leftJoin(user, eq(user.id, media.uploadedById))
    .where(
      and(
        search
          ? or(
              ilike(media.filename, `%${search}%`),
              ilike(media.alt, `%${search}%`),
            )
          : undefined,
        parseCursor(cursor),
      ),
    )
    .orderBy(desc(media.createdAt), desc(media.id))
    .limit(MEDIA_PAGE_SIZE + 1);

  const hasMore = rows.length > MEDIA_PAGE_SIZE;
  const items = rows
    .slice(0, MEDIA_PAGE_SIZE)
    .map((r) => toMediaItem(r, session));
  const last = rows[MEDIA_PAGE_SIZE - 1];
  return {
    items,
    nextCursor: hasMore && last ? `${last.cursorTs}|${last.id}` : null,
  };
}

/** How many posts reference this media as a cover or inside their content. */
export async function getMediaUsage(id: string, key: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      or(
        eq(posts.coverImageId, id),
        sql`${posts.content}::text like ${`%${key}%`}`,
      ),
    );
  return row?.count ?? 0;
}
