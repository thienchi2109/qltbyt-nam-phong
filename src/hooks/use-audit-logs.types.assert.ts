import { formatActionDetails, type AuditLogEntry } from '@/hooks/use-audit-logs'

type AssertFalse<T extends false> = T
type IsAny<T> = 0 extends (1 & T) ? true : false

type ActionDetails = NonNullable<AuditLogEntry['action_details']>
type FormatActionDetailsArg = Exclude<Parameters<typeof formatActionDetails>[1], null>

type _auditLogActionDetailsValueNotAny = AssertFalse<IsAny<ActionDetails[string]>>
type _formatActionDetailsArgValueNotAny = AssertFalse<IsAny<FormatActionDetailsArg[string]>>
