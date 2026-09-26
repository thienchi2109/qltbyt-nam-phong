import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { buildGoBffRequest } from "../GoBffRequest"

const config = {
  endpoint: "https://ai.example.internal/v1/chat",
  hmacKeyId: "key-1",
  hmacSecret: "hmac-secret",
  brokerSecret: "broker-secret",
  cloudflareClientId: "access-id",
  cloudflareClientSecret: "access-secret",
}

describe("buildGoBffRequest", () => {
  it("validates session scope and preserves the current UI message parts", async () => {
    const result = await buildGoBffRequest({
      config,
      requestId: "req-dark-1",
      nowSeconds: 1_700_000_000,
      user: {
        id: "42",
        role: "admin",
        don_vi: 7,
        khoa_phong: "ICU",
        dia_ban_id: 3,
      },
      payload: {
        selectedFacilityId: 9,
        selectedFacilityName: "Cơ sở hiển thị",
        requestedTools: ["equipmentLookup"],
        messages: [
          {
            id: "u1",
            role: "user",
            parts: [{ type: "text", text: "Tra cứu" }],
          },
          {
            id: "a1",
            role: "assistant",
            parts: [
              {
                type: "tool-equipmentLookup",
                toolCallId: "tc1",
                state: "output-available",
                output: { uiArtifact: { rawPayload: { total: 1 } } },
              },
            ],
          },
        ],
      },
    })

    const canonical = JSON.parse(result.rawBody)
    expect(canonical).toMatchObject({
      protocol_version: "v1",
      app_id: "qltbyt",
      capability_id: "assistant-chat",
      capability_version: "v1",
      request_id: "req-dark-1",
      identity: {
        issuer: "nextjs-bff",
        audience: "ai-service-v1",
        subject: "42",
        tenant: "qltbyt",
        trusted_app: { app_id: "qltbyt", capability_ids: ["assistant-chat"] },
      },
      requested_tools: ["equipmentLookup"],
      context: {
        selected_facility_id: 9,
        selected_facility_name: "Cơ sở hiển thị",
      },
    })
    expect(canonical.identity.capability_claims.broker_token).toMatch(/\./)
    expect(canonical.messages[0]).toEqual({ role: "user", content: "Tra cứu" })
    expect(canonical.messages[1].content).toContain("uiArtifact")
    expect(result.signature).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it("rejects invalid requested tools before signing", async () => {
    await expect(
      buildGoBffRequest({
        config,
        requestId: "req-dark-2",
        nowSeconds: 1_700_000_000,
        user: { id: "42", role: "user", don_vi: 7 },
        payload: {
          messages: [{ role: "user", parts: [{ type: "text", text: "Xin chào" }] }],
          requestedTools: ["unknown-tool"],
        },
      })
    ).rejects.toThrowError(/tool/i)
  })
})
