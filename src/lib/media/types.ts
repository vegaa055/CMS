/** Serializable media record passed from server to client components. */
export type MediaItem = {
  id: string;
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  createdAt: string;
  uploadedBy: { id: string; name: string } | null;
  /** Whether the current user may edit alt text / delete it. */
  canManage: boolean;
};

export type MediaPage = { items: MediaItem[]; nextCursor: string | null };
