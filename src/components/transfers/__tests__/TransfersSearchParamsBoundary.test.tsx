import * as React from "react"
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { TransfersSearchParamsBoundary } from "../TransfersSearchParamsBoundary"

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="transfer-loading-spinner" {...props} />,
}))

function createSuspendingChild() {
  let resolved = false
  let resolvePromise = () => {}
  const pendingPromise = new Promise<void>((resolve) => {
    resolvePromise = () => {
      resolved = true
      resolve()
    }
  })

  function SuspendingChild() {
    if (!resolved) {
      throw pendingPromise
    }

    return <div>Transfer filters ready</div>
  }

  return { SuspendingChild, resolvePromise }
}

describe("TransfersSearchParamsBoundary", () => {
  it("renders an accessible loading fallback while children suspend", async () => {
    const { SuspendingChild } = createSuspendingChild()

    render(
      <TransfersSearchParamsBoundary>
        <SuspendingChild />
      </TransfersSearchParamsBoundary>,
    )

    expect(screen.getByRole("status", { name: "Đang tải bộ lọc điều chuyển" })).toBeInTheDocument()
    expect(screen.getByTestId("transfer-loading-spinner")).toBeInTheDocument()
  })

  it("renders children after suspense resolves", async () => {
    const { SuspendingChild, resolvePromise } = createSuspendingChild()

    render(
      <TransfersSearchParamsBoundary>
        <SuspendingChild />
      </TransfersSearchParamsBoundary>,
    )

    await act(async () => {
      resolvePromise()
    })

    expect(await screen.findByText("Transfer filters ready")).toBeInTheDocument()
  })
})
