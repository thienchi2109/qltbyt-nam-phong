/** Signals that a streamed HTTP body exceeded its configured byte limit. */
export class BoundedBodyTooLargeError extends Error {
  constructor() {
    super("HTTP body exceeded its configured byte limit.")
    this.name = "BoundedBodyTooLargeError"
  }
}

/** Reads only up to maxBytes, cancelling the stream on overflow or abort. */
export async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Uint8Array> {
  if (!body) return new Uint8Array()

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  let completed = false
  const cancel = () => void reader.cancel().catch(() => undefined)
  const onAbort = () => {
    cancel()
  }
  signal?.addEventListener("abort", onAbort, { once: true })

  try {
    const readNext = async (): Promise<void> => {
      if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError")
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch (error) {
        if (signal?.aborted) {
          throw new DOMException("The request was aborted.", "AbortError")
        }
        throw error
      }
      const { done, value } = chunk
      if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError")
      if (done) {
        completed = true
        return
      }
      if (value) {
        totalBytes += value.byteLength
        if (totalBytes > maxBytes) throw new BoundedBodyTooLargeError()
        chunks.push(value)
      }
      return readNext()
    }
    await readNext()
  } finally {
    signal?.removeEventListener("abort", onAbort)
    if (!completed) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}
