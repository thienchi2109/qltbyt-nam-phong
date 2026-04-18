import { z } from 'zod'

import type { MigrationStatus } from '@/lib/ai/tools/registry'
import type { QueryCatalogEntry } from '@/lib/ai/tools/query-catalog'

const migratedStatus: MigrationStatus = 'migrated'
const pendingStatus: MigrationStatus = 'pending'

void migratedStatus
void pendingStatus

const validMigratedEntry: QueryCatalogEntry = {
  description: 'valid migrated tool',
  rpcFunction: 'valid_rpc',
  inputSchema: z.object({}).strict(),
  migrationStatus: 'migrated',
  modelBudget: {
    maxItems: 10,
  },
}

const validPendingEntry: QueryCatalogEntry = {
  description: 'valid pending tool',
  rpcFunction: 'valid_pending_rpc',
  inputSchema: z.object({}).strict(),
  migrationStatus: 'pending',
}

// @ts-expect-error migrated entries must define modelBudget
const invalidMigratedEntry: QueryCatalogEntry = {
  description: 'invalid migrated tool',
  rpcFunction: 'invalid_rpc',
  inputSchema: z.object({}).strict(),
  migrationStatus: 'migrated',
}

void validMigratedEntry
void validPendingEntry
void invalidMigratedEntry
