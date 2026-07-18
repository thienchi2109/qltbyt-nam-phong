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
  isSameSnapshot?: (firstPage: TPage, nextPage: TPage) => boolean
}

/** Collects every page while rejecting totals or snapshot metadata that change mid-load. */
export async function collectStableTechnicalConfigurationPages<
  TItem,
  TPage extends TechnicalConfigurationPage<TItem>,
>({
  loadPage,
  snapshotError,
  isSameSnapshot = () => true,
}: CollectStableTechnicalConfigurationPagesOptions<TItem, TPage>): Promise<{
  items: TItem[]
  firstPage: TPage
}> {
  let page = 1
  let currentPage = await loadPage(page)
  const firstPage = currentPage
  const items = [...firstPage.data]

  while (items.length < firstPage.total && currentPage.data.length > 0) {
    currentPage = await loadPage(++page)
    if (currentPage.total !== firstPage.total || !isSameSnapshot(firstPage, currentPage)) {
      throw new Error(snapshotError)
    }
    items.push(...currentPage.data)
  }

  return { items, firstPage }
}
