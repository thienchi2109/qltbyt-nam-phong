import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  handleAuthAuditCleanupRequest,
  type AuthAuditCleanupEnv,
} from './handler.ts'

function readEnv(): AuthAuditCleanupEnv {
  return {
    cronSecret: Deno.env.get('CRON_SECRET') ?? '',
    supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  }
}

Deno.serve((req: Request) =>
  handleAuthAuditCleanupRequest(req, {
    env: readEnv(),
    createRpcClient: (env) =>
      createClient(env.supabaseUrl, env.serviceRoleKey, {
        auth: { persistSession: false },
      }),
  })
)
