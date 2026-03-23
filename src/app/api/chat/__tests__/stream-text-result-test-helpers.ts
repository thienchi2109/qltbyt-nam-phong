import { simulateReadableStream } from 'ai'

export function makeReadyStreamTextResult(options?: {
  uiChunks?: Array<Record<string, unknown>>
  steps?: Array<{
    toolResults: Array<{ toolName: string; output: unknown }>
  }>
}) {
  return {
    fullStream: {
      [Symbol.asyncIterator]() {
        let index = 0
        const parts = [{ type: 'start' }, { type: 'start-step' }]

        return {
          async next() {
            if (index >= parts.length) {
              return { done: true, value: undefined }
            }

            return { done: false, value: parts[index++] }
          },
          async return() {
            return { done: true, value: undefined }
          },
        }
      },
    },
    toUIMessageStream: () =>
      simulateReadableStream({
        chunks:
          options?.uiChunks ??
          [
            { type: 'start' },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'OK' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop' },
          ],
      }),
    steps: Promise.resolve(options?.steps ?? []),
  }
}

export function parseSseJsonChunks(payload: string): Array<Record<string, unknown>> {
  return payload
    .split('\n')
    .filter(line => line.startsWith('data: '))
    .map(line => line.slice('data: '.length))
    .filter(line => line && line !== '[DONE]')
    .map(line => JSON.parse(line) as Record<string, unknown>)
}

