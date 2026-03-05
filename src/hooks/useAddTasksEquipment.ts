/**
 * useAddTasksEquipment.ts
 *
 * TanStack Query hook to fetch all equipment for the add-tasks dialog.
 * Replaces the useState+useEffect fetch pattern with proper caching and typing.
 */

import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import type { Equipment } from '@/lib/data'

/**
 * Upper bound for the client-side "load-all" fetch.
 * The add-tasks dialog needs all equipment in memory for client-side
 * faceted filtering, global search, and row selection.
 * If the dataset hits this limit, a console.warn fires so operators
 * know to consider server-side pagination.
 */
export const EQUIPMENT_FETCH_LIMIT = 10_000

export function useAddTasksEquipment(open: boolean) {
  return useQuery<Equipment[], Error>({
    queryKey: ['equipment_list', 'add-tasks'],
    queryFn: async () => {
      const data = await callRpc<Equipment[]>({
        fn: 'equipment_list',
        args: {
          p_q: null,
          p_sort: 'id.asc',
          p_page: 1,
          p_page_size: EQUIPMENT_FETCH_LIMIT,
        },
      })

      if (data.length >= EQUIPMENT_FETCH_LIMIT) {
        console.warn(
          `[useAddTasksEquipment] equipment_list returned ${data.length} rows, ` +
          `hitting the ${EQUIPMENT_FETCH_LIMIT} limit. Some equipment may be missing. ` +
          `Consider migrating to server-side pagination.`,
        )
      }

      return data
    },
    enabled: open,
  })
}
