import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

type NextAfterTask = Promise<unknown> | (() => unknown | Promise<unknown>)

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: (task: NextAfterTask) => {
      setTimeout(() => {
        if (typeof task === 'function') {
          void task()
          return
        }
        void task
      }, 0)
    },
  }
})
