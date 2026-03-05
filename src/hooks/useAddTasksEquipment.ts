/**
 * useAddTasksEquipment.ts
 *
 * TanStack Query hook to fetch all equipment for the add-tasks dialog.
 * Replaces the useState+useEffect fetch pattern with proper caching and typing.
 */

import { useQuery } from '@tanstack/react-query'
import { callRpc } from '@/lib/rpc-client'
import type { Equipment } from '@/lib/data'

export function useAddTasksEquipment(open: boolean) {
  return useQuery<Equipment[], Error>({
    queryKey: ['equipment_list', 'add-tasks'],
    queryFn: () =>
      callRpc<Equipment[]>({
        fn: 'equipment_list',
        args: { p_q: null, p_sort: 'id.asc', p_page: 1, p_page_size: 5000 },
      }),
    enabled: open,
  })
}
