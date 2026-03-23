export function makeReadyStreamResult(responseFactory?: () => Response) {
  return {
    fullStream: {
      [Symbol.asyncIterator]() {
        let done = false
        return {
          async next() {
            if (done) {
              return { done: true, value: undefined }
            }

            done = true
            return { done: false, value: { type: 'start-step' } }
          },
          async return() {
            return { done: true, value: undefined }
          },
        }
      },
    },
    toUIMessageStreamResponse: () =>
      responseFactory?.() ?? new Response(null, { status: 200 }),
  }
}
