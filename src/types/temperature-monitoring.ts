/** Public RPC DTOs; historical policy and observation times stay separate from entry time. */
export interface TemperatureState {
  effective: {
    value_c: number | null
    unable_reason: { reason: string } | null
    author_user_id: number
  }
  review_required: boolean
  review_state: string
  pending_amendment_id: string | null
}
export interface TemperatureSlot {
  equipment_id: number
  equipment_code: string
  equipment_name: string
  monitoring_date: string
  shift_id: string
  shift_code: string
  shift_name: string
  slot_start: string
  slot_end: string
  display_timezone: string
  configuration_version_id: string
  lower_c: number
  upper_c: number
  recording_method_code: string
  recording_method_name: string
  status: string
  reading_id: string | null
  value_c: number | null
  captured_at: string | null
  created_at: string | null
  operator_user_id: number | null
  proposal_author_user_id: number | null
  revision: number
  state: TemperatureState | null
  deviation: Pick<TemperatureDeviation, "id" | "status" | "severity" | "revision"> | null
}
export interface TemperatureWorkspace {
  empty_reason:
    "no_pending_work" | "no_matches" | "no_monitored_equipment" | "no_eligible_slots" | null
  shift_choices: { code: string; name: string }[]
  items: TemperatureSlot[]
  total: number
  next_cursor: Record<string, unknown> | null
  server_now: string
  from_date: string
  to_date: string
}
export interface TemperatureReading extends TemperatureState {
  reading: {
    id: string
    captured_at: string
    created_at: string
    operator_user_id: number
    value_c: number | null
    unable_reason: { reason: string } | null
  }
  revision: number
  outcome?: string
  pending_amendment?: {
    id: string
    value_c: number | null
    unable_reason: { reason: string } | null
    reason: string
    author_user_id: number
  } | null
}
export interface TemperatureDeviation {
  id: string
  revision: number
  status: string
  severity: string
  immediate_action: string | null
  cause: string | null
  evidence: string | null
  owner_user_id: number | null
  due_at: string | null
  verification_result: string | null
  repair_request_id: number | null
  outcome?: string
}
export interface TemperatureChoices {
  methods: { code: string; name: string }[]
  profiles: { id: string; name: string; code: string }[]
  configuration: {
    monitoring_enabled: boolean
    lower_c: number
    upper_c: number
    schedule_profile_id: string
    responsible_primary_user_id: number
    responsible_substitute_user_ids: number[]
    recording_method_code: string
    display_timezone: string
  } | null
  server_now: string
  suggested_effective_from: string | null
}
export interface TemperatureStaff {
  items: { id: number; full_name: string }[]
  next_cursor: number | null
}
export interface TemperatureNotifications {
  pending_review: number
  open_deviations: number
  from_date: string
  to_date: string
  items: {
    equipment_id: number
    equipment_name: string
    monitoring_date: string
    reading_id: string
    kind: "review" | "deviation"
  }[]
}
