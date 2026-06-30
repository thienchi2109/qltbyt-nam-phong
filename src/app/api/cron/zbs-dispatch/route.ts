import { createClient } from "@supabase/supabase-js"

import { dispatchPendingZbsNotifications } from "@/lib/zbs/live-dispatcher"

/** Keep the ZBS dispatch endpoint uncached so each cron/manual call evaluates live state. */
export const dynamic = "force-dynamic"
/** Use Node.js runtime for service-role Supabase RPC calls and outbound Zalo fetches. */
export const runtime = "nodejs"

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status })
}

function readDispatchEnabled() {
  return process.env.ZALO_ZBS_DISPATCH_ENABLED === "true"
}

function readAppBaseUrl() {
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? vercelUrl
}

function readOutboxIds(request: Request): string[] | undefined {
  const { searchParams } = new URL(request.url)
  const ids = searchParams
    .getAll("outboxId")
    .map((id) => id.trim())
    .filter(Boolean)

  return ids.length > 0 ? ids : undefined
}

function readSupabaseEnv(): { supabaseUrl: string; serviceRoleKey: string } | null {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  return supabaseUrl && serviceRoleKey ? { supabaseUrl, serviceRoleKey } : null
}

/** Runs one guarded ZBS dispatch batch for cron/manual operations. */
export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error("Missing ZBS dispatch cron secret")
    return jsonResponse(
      { error: "Server configuration error: missing required environment variables" },
      500
    )
  }

  if (request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized ZBS dispatch cron attempt", {
      userAgent: request.headers.get("user-agent"),
    })
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  const supabaseEnv = readSupabaseEnv()
  if (!supabaseEnv) {
    console.error("Missing ZBS dispatch Supabase environment variables")
    return jsonResponse(
      { error: "Server configuration error: missing required environment variables" },
      500
    )
  }

  const supabase = createClient(supabaseEnv.supabaseUrl, supabaseEnv.serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    const result = await dispatchPendingZbsNotifications({
      dispatchEnabled: readDispatchEnabled(),
      accessToken: process.env.ZALO_ZBS_ACCESS_TOKEN,
      repairTemplateId: process.env.ZALO_ZBS_REPAIR_TEMPLATE_ID,
      appBaseUrl: readAppBaseUrl(),
      outboxIds: readOutboxIds(request),
      rpcClient: async ({ fn, args }) => {
        const { data, error } = await supabase.rpc(fn, args)
        if (error) {
          throw new Error(error.message || "ZBS dispatch RPC failed")
        }
        return data
      },
    })

    return jsonResponse({ success: true, result }, 200)
  } catch {
    console.error("ZBS dispatch cron failed")
    return jsonResponse({ error: "ZBS dispatch failed" }, 500)
  }
}
