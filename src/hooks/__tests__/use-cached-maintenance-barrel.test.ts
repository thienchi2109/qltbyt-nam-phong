import * as CachedMaintenance from '@/hooks/use-cached-maintenance'

describe('cached maintenance public API', () => {
  it.each([
    'maintenanceKeys',
    'useMaintenancePlans',
    'useCreateMaintenancePlan',
    'useUpdateMaintenancePlan',
    'useApproveMaintenancePlan',
    'useRejectMaintenancePlan',
    'useDeleteMaintenancePlan',
  ])('exposes %s', (name) => {
    expect(name in CachedMaintenance).toBe(true)
  })

  it.each([
    'useMaintenanceSchedules',
    'useMaintenanceHistory',
    'useMaintenanceDetail',
    'useCreateMaintenanceSchedule',
    'useUpdateMaintenanceSchedule',
    'useCompleteMaintenance',
    'useDeleteMaintenanceSchedule',
  ])('does not expose %s', (name) => {
    expect(name in CachedMaintenance).toBe(false)
  })
})
