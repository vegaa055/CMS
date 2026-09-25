/** Public URL path for a post. The public route itself lands in Phase 6. */
export function postPath(slug: string) {
  return `/posts/${slug}`;
}

export function previewPath(id: string) {
  return `/preview/posts/${id}`;
}

export function tagPath(slug: string) {
  return `/tags/${slug}`;
}
