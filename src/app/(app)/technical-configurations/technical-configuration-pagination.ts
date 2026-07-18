type TechnicalConfigurationPage<TItem> = {
  data: TItem[]
  total: number
}

type CollectStableTechnicalConfigurationPagesOptions<
  TItem,
  TPage extends TechnicalConfigurationPage<TItem>,
> = {
  loadPage: (page: number) => Promise<TPage>
  snapshotError: string
  getItemKey: (item: TItem) => string
  isSameSnapshot?: (firstPage: TPage, nextPage: TPage) => boolean
}

/** Collects every page while rejecting incomplete, duplicate, or changed snapshots. */
export async function collectStableTechnicalConfigurationPages<
  TItem,
  TPage extends TechnicalConfigurationPage<TItem>,
>({
  loadPage,
  snapshotError,
  getItemKey,
  isSameSnapshot = () => true,
}: CollectStableTechnicalConfigurationPagesOptions<TItem, TPage>): Promise<{
  items: TItem[]
  firstPage: TPage
}> {
  let page = 1
  let currentPage = await loadPage(page)
  const firstPage = currentPage
  const items: TItem[] = []
  const itemKeys = new Set<string>()
  const appendPage = (pageItems: TItem[]) => {
    if (pageItems.length === 0 && items.length < firstPage.total) {
      throw new Error(snapshotError)
    }

    for (const item of pageItems) {
      const itemKey = getItemKey(item)
      if (itemKeys.has(itemKey)) throw new Error(snapshotError)
      itemKeys.add(itemKey)
      items.push(item)
    }

    if (items.length > firstPage.total) throw new Error(snapshotError)
  }

  appendPage(firstPage.data)

  while (items.length < firstPage.total) {
    currentPage = await loadPage(++page)
    if (currentPage.total !== firstPage.total || !isSameSnapshot(firstPage, currentPage)) {
      throw new Error(snapshotError)
    }
    appendPage(currentPage.data)
  }

  return { items, firstPage }
}
