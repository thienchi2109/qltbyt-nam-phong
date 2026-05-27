const SAME_ORIGIN_ERROR_MESSAGE = 'Cross-origin request rejected'

/** Error raised when a state-changing route receives a non-same-origin request. */
export class SameOriginRequestError extends Error {
  readonly status = 403

  constructor() {
    super(SAME_ORIGIN_ERROR_MESSAGE)
    this.name = 'SameOriginRequestError'
  }
}

function readRequestOrigin(req: Request): URL {
  try {
    return new URL(req.url)
  } catch {
    throw new SameOriginRequestError()
  }
}

function parseOrigin(value: string): URL {
  try {
    return new URL(value)
  } catch {
    throw new SameOriginRequestError()
  }
}

function sameOrigin(a: URL, b: URL): boolean {
  return a.origin.toLowerCase() === b.origin.toLowerCase()
}

/** Rejects cross-origin browser POSTs while preserving legacy requests without Origin. */
export function assertSameOriginRequest(req: Request): void {
  const originHeader = req.headers.get('origin')
  // Some legacy clients and unit tests do not send Origin. Browsers send it for cross-origin POSTs.
  if (!originHeader) {
    return
  }

  const origin = parseOrigin(originHeader)
  const requestOrigin = readRequestOrigin(req)

  if (!sameOrigin(origin, requestOrigin)) {
    throw new SameOriginRequestError()
  }
}
