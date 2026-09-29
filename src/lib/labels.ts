/**
 * Display labels for category and domain slugs (Florian, 2026-09-29:
 * "human-spaceflight" reads as "human spaceflight"). The slug stays the
 * data value and the URL; only what the reader sees changes. Tags keep
 * their slug form because they render as hashtags.
 */
export function label(slug: string): string {
  return slug.replace(/-/g, " ");
}
