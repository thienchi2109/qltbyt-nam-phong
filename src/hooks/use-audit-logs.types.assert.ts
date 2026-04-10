import { formatActionDetails, type AuditLogEntry } from '@/hooks/use-audit-logs'

type AssertFalse<T extends false> = T
type IsAny<T> = 0 extends (1 & T) ? true : false

type ActionDetailsRecord = Extract<NonNullable<AuditLogEntry['action_details']>, Record<string, unknown>>
type FormatActionDetailsArgRecord = Extract<Exclude<Parameters<typeof formatActionDetails>[1], null>, Record<string, unknown>>

type _auditLogActionDetailsValueNotAny = AssertFalse<IsAny<ActionDetailsRecord[string]>>
type _formatActionDetailsArgValueNotAny = AssertFalse<IsAny<FormatActionDetailsArgRecord[string]>>
