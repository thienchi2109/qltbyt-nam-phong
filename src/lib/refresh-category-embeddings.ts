// Shared helper: fire-and-forget embedding refresh for categories
// Called from category mutation hooks after successful create/update/import

/**
 * Trigger async embedding refresh for specified category IDs.
 * Fire-and-forget: never blocks the calling operation.
 */
export async function refreshCategoryEmbeddings(
  categoryIds: number[]
): Promise<void> {
  if (!categoryIds.length) return

  try {
    await fetch('/api/embeddings/refresh-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_ids: categoryIds }),
    })
  } catch {
    // Fire-and-forget: don't block category operations
    console.warn('Failed to refresh category embeddings for ids:', categoryIds)
  }
}
