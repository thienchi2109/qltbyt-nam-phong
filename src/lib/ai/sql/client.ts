import 'server-only'

import postgres from 'postgres'

import type { AssistantSqlDb, AssistantSqlTransaction } from './executor'
import { AssistantSqlError } from './errors'

type PostgresClient = ReturnType<typeof postgres>
type PostgresTransaction = postgres.TransactionSql<Record<string, unknown>>

const globalForAssistantSql = globalThis as typeof globalThis & {
  __assistantSqlClient?: PostgresClient
}

function createAssistantSqlClient(): PostgresClient {
  const databaseUrl = process.env.AI_DATABASE_URL
  if (!databaseUrl) {
    throw new AssistantSqlError(
      'configuration_error',
      'AI_DATABASE_URL is required for assistant SQL execution.',
    )
  }

  return postgres(databaseUrl, {
    connect_timeout: 10,
    idle_timeout: 5,
    max: 1,
    prepare: false,
    ssl: 'require',
  })
}

function getClient(): PostgresClient {
  if (globalForAssistantSql.__assistantSqlClient === undefined) {
    globalForAssistantSql.__assistantSqlClient = createAssistantSqlClient()
  }

  return globalForAssistantSql.__assistantSqlClient
}

function wrapTransaction(tx: PostgresTransaction): AssistantSqlTransaction {
  return {
    setLocal: async (name, value) => {
      await tx`select set_config(${name}, ${value}, true)`
    },
    unsafe: async statement => {
      const rows = await tx.unsafe<Array<Record<string, unknown>>>(statement)
      return [...rows] as Array<Record<string, unknown>>
    },
  }
}

export function getAssistantSqlDb(): AssistantSqlDb {
  return {
    begin: async callback => {
      const [result] = await getClient().begin(async tx => [
        await callback(wrapTransaction(tx)),
      ])
      return result
    },
  }
}
