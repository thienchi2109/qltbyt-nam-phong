import { beforeAll, afterAll, describe, expect, it, vi } from "vitest"
import postgres from "postgres"

import { signWebPushRequest } from "@/lib/web-push/wire"
import { POST as postClaim } from "../../internal/web-push/v1/claim/route"
import { POST as postReport } from "../../internal/web-push/v1/report/route"
import {
  request,
  VALID_AUTH,
  VALID_P256DH,
  VALID_VAPID_FINGERPRINT,
  VALID_VAPID_VERSION,
} from "./test-fixtures"

vi.mock("server-only", () => ({}))

type Database = ReturnType<typeof postgres>
const databaseUrl = process.env.WEB_PUSH_PHASE4_DATABASE_URL
function isDisposableDatabaseUrl(value: string): boolean {
  try {
    const databaseName = decodeURIComponent(new URL(value).pathname.slice(1))
    return /^dq_webpush_phase4_[a-z0-9_]+$/.test(databaseName)
  } catch {
    return false
  }
}

if (databaseUrl && !isDisposableDatabaseUrl(databaseUrl)) {
  throw new Error("WEB_PUSH_PHASE4_DATABASE_URL must target a dq_webpush_phase4_* database")
}
const run = databaseUrl ? describe : describe.skip

run("web push Phase 4 disposable worker contract", () => {
  let root: Database
  let active: Database

  beforeAll(() => {
    root = postgres(databaseUrl as string, { max: 1, idle_timeout: 5 })
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key")
    vi.stubEnv("SUPABASE_JWT_SECRET", "test-jwt-secret")
    vi.stubEnv("WEB_PUSH_ORIGIN", "https://app.example")
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await root.end({ timeout: 5 })
  })

  it("round-trips signed claim/report through real SQL and fences replay", async () => {
    class Rollback extends Error {}
    let failure: unknown
    try {
      await root.begin(async (transaction) => {
        active = transaction as unknown as Database
        try {
          const suffix = Math.floor(Date.now() / 1000) % 1000000
          const id = 2146000000 + suffix
          const endpoint = `https://push.example.test/phase4-${id}`
          const notificationId = "00000000-0000-4000-8000-000000000010"
          const secret = Buffer.alloc(32, 9).toString("base64")
          vi.stubEnv("WEB_PUSH_HMAC_CURRENT_KEY_ID", "disposable-key")
          vi.stubEnv("WEB_PUSH_HMAC_CURRENT_SECRET", secret)

          await active`
            INSERT INTO public.dia_ban(id, ma_dia_ban, ten_dia_ban)
            VALUES (${id}, ${`webpush-${id}`}, 'Web Push disposable')
          `
          await active`
            INSERT INTO public.don_vi(id, name, dia_ban_id)
            VALUES (${id}, ${`Web Push ${id}`}, ${id})
          `
          await active`
            INSERT INTO public.nhan_vien(
              id, username, password, role, don_vi, dia_ban_id, khoa_phong
            ) VALUES (
              ${id}, ${`webpush-${id}`}, 'unused', 'user', ${id}, ${id}, 'CT'
            )
          `
          await active`
            INSERT INTO public.thiet_bi(
              id, ma_thiet_bi, ten_thiet_bi, don_vi, khoa_phong_quan_ly, is_deleted
            ) VALUES (${id}, ${`WEBPUSH-${id}`}, 'Disposable device', ${id}, 'CT', false)
          `
          await active`
            INSERT INTO public.yeu_cau_sua_chua(id, thiet_bi_id, mo_ta_su_co)
            VALUES (${id}, ${id}, 'Disposable Web Push request')
          `
          await active`
            INSERT INTO public.web_push_recipient_configs(don_vi_id, user_id)
            VALUES (${id}, ${id})
          `
          await active`
            INSERT INTO public.web_push_subscriptions(
              user_id, endpoint, p256dh, auth, vapid_key_version, authorization_epoch
            )
            SELECT ${id}, ${endpoint}, ${VALID_P256DH}, ${VALID_AUTH}, ${VALID_VAPID_VERSION},
              password_changed_at
            FROM public.nhan_vien WHERE id = ${id}
          `
          await active`
            INSERT INTO public.web_push_notification_intents(
              id, event_type, request_id, recipient_user_id, don_vi_id, payload
            ) VALUES (
              ${notificationId}::uuid, 'repair_request_created', ${id}, ${id}, ${id},
              ${active.json({
                version: 1,
                notification_id: notificationId,
                title: "Disposable",
                body: "Web Push",
                url: "/repair-requests?action=view&requestId=1",
                tag: "repair-request:1",
              })}
            )
          `
          await active`
            UPDATE public.web_push_runtime_controls
            SET registration_enabled = true,
                dispatch_enabled = true,
                dispatch_canary_don_vi_ids = ARRAY[${id}]::bigint[],
                vapid_key_version = ${VALID_VAPID_VERSION},
                vapid_public_key = ${VALID_P256DH},
                vapid_fingerprint = ${VALID_VAPID_FINGERPRINT}
            WHERE singleton
          `

          vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
            const pathname = new URL(String(input)).pathname
            const fn = pathname.split("/").at(-1)
            const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
            if (fn === "web_push_runtime_controls_get") {
              const rows = (await active`
                SELECT public.web_push_runtime_controls_get() AS result
              `) as Array<{ result: unknown }>
              return Response.json(rows[0].result)
            }
            if (fn === "web_push_worker_nonce_consume") {
              const rows = (await active`
                SELECT public.web_push_worker_nonce_consume(
                  ${body.p_key_id as string}, ${body.p_nonce as string}
                ) AS result
              `) as Array<{ result: boolean }>
              return Response.json(rows[0].result)
            }
            if (fn === "web_push_delivery_claim") {
              const rows = (await active`
                SELECT public.web_push_delivery_claim(
                  ${active.json(body.p_request)}
                ) AS result
              `) as Array<{ result: unknown }>
              return Response.json(rows[0].result)
            }
            if (fn === "web_push_delivery_report") {
              const rows = (await active`
                SELECT public.web_push_delivery_report(
                  ${active.json(body.p_request)}
                ) AS result
              `) as Array<{ result: unknown }>
              return Response.json(rows[0].result)
            }
            throw new Error(`unexpected RPC ${fn}`)
          })

          const claimBody = JSON.stringify({
            version: 1,
            worker_id: "disposable-worker",
            limit: 1,
            vapid_key_version: VALID_VAPID_VERSION,
            vapid_fingerprint: VALID_VAPID_FINGERPRINT,
          })
          const claimTimestamp = Math.floor(Date.now() / 1000).toString()
          const claimNonce = "7172737475767778797a7b7c7d7e7f80"
          const claim = await postClaim(
            request("https://app.example/api/internal/web-push/v1/claim", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-web-push-key-id": "disposable-key",
                "x-web-push-timestamp": claimTimestamp,
                "x-web-push-nonce": claimNonce,
                "x-web-push-signature": signWebPushRequest(secret, {
                  keyId: "disposable-key",
                  method: "POST",
                  path: "/api/internal/web-push/v1/claim",
                  timestamp: claimTimestamp,
                  nonce: claimNonce,
                  rawBody: claimBody,
                }),
              },
              body: claimBody,
            })
          )
          expect(claim.status).toBe(200)
          const claimResult = (await claim.json()) as {
            deliveries: Array<Record<string, string>>
          }
          expect(claimResult.deliveries).toHaveLength(1)

          const delivery = claimResult.deliveries[0]
          const reportBody = JSON.stringify({
            version: 1,
            results: [
              {
                delivery_id: delivery.delivery_id,
                attempt_token: delivery.attempt_token,
                subscription_revision: delivery.subscription_revision,
                outcome: "accepted",
                provider_status: 201,
                retry_after_seconds: null,
              },
            ],
          })
          const reportTimestamp = Math.floor(Date.now() / 1000).toString()
          const reportNonce = "8182838485868788898a8b8c8d8e8f90"
          const reportHeaders = {
            "content-type": "application/json",
            "x-web-push-key-id": "disposable-key",
            "x-web-push-timestamp": reportTimestamp,
            "x-web-push-nonce": reportNonce,
            "x-web-push-signature": signWebPushRequest(secret, {
              keyId: "disposable-key",
              method: "POST",
              path: "/api/internal/web-push/v1/report",
              timestamp: reportTimestamp,
              nonce: reportNonce,
              rawBody: reportBody,
            }),
          }
          const report = await postReport(
            request("https://app.example/api/internal/web-push/v1/report", {
              method: "POST",
              headers: reportHeaders,
              body: reportBody,
            })
          )
          expect(report.status).toBe(200)
          expect(await report.json()).toMatchObject({ results: [{ result: "applied" }] })

          const duplicateNonce = "9192939495969798999a9b9c9d9e9fa0"
          const duplicateTimestamp = Math.floor(Date.now() / 1000).toString()
          const duplicate = await postReport(
            request("https://app.example/api/internal/web-push/v1/report", {
              method: "POST",
              headers: {
                ...reportHeaders,
                "x-web-push-timestamp": duplicateTimestamp,
                "x-web-push-nonce": duplicateNonce,
                "x-web-push-signature": signWebPushRequest(secret, {
                  keyId: "disposable-key",
                  method: "POST",
                  path: "/api/internal/web-push/v1/report",
                  timestamp: duplicateTimestamp,
                  nonce: duplicateNonce,
                  rawBody: reportBody,
                }),
              },
              body: reportBody,
            })
          )
          expect(duplicate.status).toBe(200)
          expect(await duplicate.json()).toMatchObject({ results: [{ result: "duplicate" }] })

          const replay = await postReport(
            request("https://app.example/api/internal/web-push/v1/report", {
              method: "POST",
              headers: reportHeaders,
              body: reportBody,
            })
          )
          expect(replay.status).toBe(409)
          expect(await replay.json()).toMatchObject({ error: { code: "replay" } })
        } catch (error) {
          failure = error
        }
        throw new Rollback()
      })
    } catch (error) {
      if (!(error instanceof Rollback)) throw error
    }
    if (failure) throw failure
  }, 60_000)
})
