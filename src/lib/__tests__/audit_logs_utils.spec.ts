import { describe, it, expect } from 'vitest'

// Import utilities from the hook module
import { getActionTypeLabel, formatActionDetails, ACTION_TYPE_LABELS, type AuditLogEntry } from '@/hooks/use-audit-logs'

describe('Activity Logs utilities', () => {
  it('maps action types to Vietnamese labels', () => {
    expect(getActionTypeLabel('maintenance_plan_create')).toBe('Tạo kế hoạch bảo trì')
    expect(getActionTypeLabel('non_existing_key')).toBe('non_existing_key')
  })

  it('formats details for equipment update', () => {
    const details = { equipment_name: 'Máy siêu âm A1' }
    const text = formatActionDetails('equipment_update', details)
    expect(text).toContain('Thiết bị')
    expect(text).toContain('Máy siêu âm A1')
  })

  it('AuditLogEntry type includes entity fields (compile-time)', () => {
    const row: AuditLogEntry = {
      id: 1,
      admin_user_id: 1,
      admin_username: 'admin',
      admin_full_name: 'Admin',
      action_type: 'repair_request_create',
      target_user_id: null,
      target_username: null,
      target_full_name: null,
      action_details: { a: 1 },
      ip_address: null,
      user_agent: null,
      created_at: new Date().toISOString(),
      total_count: 1,
      entity_type: 'repair_request',
      entity_id: 123,
      entity_label: 'YC-123',
    }
    expect(row.entity_type).toBe('repair_request')
  })
})
