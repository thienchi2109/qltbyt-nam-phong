import {
  type AsyncIterableStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type InferUIMessageChunk,
  type UIMessage,
  type UIMessageStreamOptions,
  type UIMessageStreamWriter,
} from 'ai'

interface StreamReadyPart {
  type: string
  error?: unknown
}

interface StreamReadyResult {
  fullStream: AsyncIterable<StreamReadyPart>
}

interface UIStreamResult {
  toUIMessageStream<UI_MESSAGE extends UIMessage>(
    options?: UIMessageStreamOptions<UI_MESSAGE>,
  ): AsyncIterableStream<InferUIMessageChunk<UI_MESSAGE>>
}

export async function waitForStreamReady(
  result: StreamReadyResult,
  shouldThrowError?: (error: unknown) => boolean,
): Promise<void> {
  const iterator = result.fullStream[Symbol.asyncIterator]()

  try {
    while (true) {
      const { value, done } = await iterator.next()

      if (done) {
        throw new Error('AI stream ended before producing a response part')
      }

      if (value.type === 'start') {
        continue
      }

      if (value.type === 'error') {
        if (shouldThrowError?.(value.error)) {
          throw value.error
        }

        return
      }

      return
    }
  } finally {
    try {
      await iterator.return?.()
    } catch {
      // Best-effort cleanup only. Preserve the original success/error outcome.
    }
  }
}

export function createChatUIStreamResponse({
  result,
  originalMessages,
  onError,
  onAfterBaseStream,
}: {
  result: UIStreamResult
  originalMessages: UIMessage[]
  onError: (error: unknown) => string
  onAfterBaseStream?: (writer: UIMessageStreamWriter<UIMessage>) => Promise<void>
}): Response {
  const stream = createUIMessageStream({
    originalMessages,
    onError,
    execute: async ({ writer }) => {
      for await (const part of result.toUIMessageStream({
        originalMessages,
        onError,
      })) {
        writer.write(part)
      }

      await onAfterBaseStream?.(writer)
    },
  })

  return createUIMessageStreamResponse({ stream })
}
