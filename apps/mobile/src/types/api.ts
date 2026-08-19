// Re-export the shared API contract types from @saecula/contracts.
// Kept at this path so existing `@/types/api` imports keep working; the single
// source of truth lives in packages/contracts.
export * from '@saecula/contracts';

// --- Bookmarks / Saved Verses -----------------------------------------------
// Not yet in @saecula/contracts; kept locally until the backend exposes them
// through the shared contract package.

export interface SavedVerse {
  id: string;
  entity_id: string;
  reference: string;
  verse_text: string;
  highlight_color?: string | null;
  note?: string | null;
  // Null/undefined for a standalone bookmark; shared across the rows of a
  // multi-verse group.
  group_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedVersesResponse {
  count: number;
  verses: SavedVerse[];
}

export interface CreateBookmarkGroupRequest {
  verses: { entity_id: string; reference: string; verse_text: string }[];
  highlight_color?: string | null;
  note?: string | null;
}
