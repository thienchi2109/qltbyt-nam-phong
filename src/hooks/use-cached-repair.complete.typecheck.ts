import { useCompleteRepairRequest } from '@/hooks/use-cached-repair'

type CompleteRepairRequestVariables = Parameters<
  ReturnType<typeof useCompleteRepairRequest>['mutate']
>[0]

const validCompleteParams: CompleteRepairRequestVariables = {
  id: '123',
  ket_qua: 'Đã xử lý',
  ghi_chu: 'Hoàn tất',
}

void validCompleteParams

const invalidWithAssignee: CompleteRepairRequestVariables = {
  id: '123',
  // @ts-expect-error RPC-backed completion should not accept legacy direct-table assignee field.
  nguoi_xu_ly: 'tech-01',
}

void invalidWithAssignee

const invalidWithCost: CompleteRepairRequestVariables = {
  id: '123',
  // @ts-expect-error RPC-backed completion should not accept legacy direct-table cost field.
  chi_phi: 500000,
}

void invalidWithCost
