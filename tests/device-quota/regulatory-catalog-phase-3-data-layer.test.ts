import { describe, expect, it } from "vitest"

import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"

describe("device quota Phase 3 data-layer RPC reachability", () => {
  it("allows the immutable regulatory catalog read through the existing proxy allowlist", () => {
    expect(ALLOWED_FUNCTIONS.has("device_quota_regulatory_catalog_get")).toBe(true)
  })
})
