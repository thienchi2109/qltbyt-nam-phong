import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}

type NextAfterTask = Promise<unknown> | (() => unknown | Promise<unknown>)

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>()
  return {
    ...actual,
    after: (task: NextAfterTask) => {
      setTimeout(() => {
        if (typeof task === "function") {
          void task()
          return
        }
        void task
      }, 0)
    },
  }
})
