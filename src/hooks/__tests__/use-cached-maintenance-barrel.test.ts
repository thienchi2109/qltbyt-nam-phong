import * as CachedMaintenance from '@/hooks/use-cached-maintenance'

describe('cached maintenance public API', () => {
  it.each([
    'maintenanceKeys',
    'useMaintenancePlans',
    'useMaintenanceHistory',
    'useCreateMaintenancePlan',
    'useUpdateMaintenancePlan',
    'useApproveMaintenancePlan',
    'useRejectMaintenancePlan',
    'useDeleteMaintenancePlan',
    'useUpdateMaintenanceSchedule',
  ])('exposes %s', (name) => {
    expect(name in CachedMaintenance).toBe(true)
  })

  it.each([
    'useMaintenanceSchedules',
    'useMaintenanceDetail',
    'useCreateMaintenanceSchedule',
    'useCompleteMaintenance',
    'useDeleteMaintenanceSchedule',
  ])('does not expose %s', (name) => {
    expect(name in CachedMaintenance).toBe(false)
  })
})
