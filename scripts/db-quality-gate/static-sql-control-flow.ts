import type { SqlToken } from "./static-sql-tokens"

/** Detects whether a statement is nested under conditional or exception control flow. */
export function isConditionallyNested(tokens: SqlToken[], index: number): boolean {
  let blockDepth = 0
  let conditionalDepth = 0
  const exceptionBlocks: number[] = []

  for (let cursor = 0; cursor < index; cursor += 1) {
    const token = tokens[cursor]
    const next = tokens[cursor + 1]?.value

    if (token.value === "end" && ["case", "if", "loop"].includes(next)) {
      conditionalDepth = Math.max(0, conditionalDepth - 1)
      cursor += 1
      continue
    }
    if (token.value === "end") {
      blockDepth = Math.max(0, blockDepth - 1)
      while (exceptionBlocks.at(-1) !== undefined && exceptionBlocks.at(-1)! > blockDepth) {
        exceptionBlocks.pop()
      }
      continue
    }
    if (token.value === "begin") {
      blockDepth += 1
      continue
    }
    if (["case", "if", "loop"].includes(token.value)) {
      conditionalDepth += 1
      continue
    }
    if (token.value === "exception" && tokens[cursor - 1]?.value !== "raise") {
      exceptionBlocks.push(blockDepth)
    }
  }

  return conditionalDepth > 0 || exceptionBlocks.length > 0
}

function exceptionBlockEnd(tokens: SqlToken[], exceptionIndex: number): number {
  let nestedBlocks = 0

  for (let index = exceptionIndex + 1; index < tokens.length; index += 1) {
    if (tokens[index].value === "begin") {
      nestedBlocks += 1
      continue
    }
    if (
      tokens[index].value !== "end" ||
      ["case", "if", "loop"].includes(tokens[index + 1]?.value)
    ) {
      continue
    }
    if (nestedBlocks === 0) {
      return index
    }
    nestedBlocks -= 1
  }

  return tokens.length
}

function handlerPropagatesPermissionFailure(handler: SqlToken[]): boolean {
  const thenIndex = handler.findIndex((token) => token.value === "then")
  const raiseIndex = thenIndex + 1
  if (thenIndex === -1 || handler[raiseIndex]?.value !== "raise") {
    return false
  }
  if (handler[raiseIndex + 1]?.value === ";") {
    return true
  }
  if (handler[raiseIndex + 1]?.value !== "exception") {
    return false
  }
  const end = handler.findIndex(
    (candidate, cursor) => cursor > raiseIndex && candidate.value === ";"
  )

  return handler
    .slice(raiseIndex + 2, end === -1 ? handler.length : end)
    .some(
      (candidate, cursor, statement) =>
        candidate.value === "errcode" &&
        statement[cursor + 1]?.value === "=" &&
        statement[cursor + 2]?.type === "string" &&
        statement[cursor + 2].value === "42501"
    )
}

/** Detects any exception handler that can swallow a permission failure. */
export function hasSwallowedPermissionException(tokens: SqlToken[]): boolean {
  for (let exceptionIndex = 0; exceptionIndex < tokens.length; exceptionIndex += 1) {
    if (
      tokens[exceptionIndex].value !== "exception" ||
      tokens[exceptionIndex - 1]?.value === "raise"
    ) {
      continue
    }
    const end = exceptionBlockEnd(tokens, exceptionIndex)
    const handlerStarts: number[] = []
    let nestedBlocks = 0

    for (let index = exceptionIndex + 1; index < end; index += 1) {
      if (tokens[index].value === "begin") {
        nestedBlocks += 1
      } else if (
        tokens[index].value === "end" &&
        !["case", "if", "loop"].includes(tokens[index + 1]?.value)
      ) {
        nestedBlocks = Math.max(0, nestedBlocks - 1)
      } else if (nestedBlocks === 0 && tokens[index].value === "when") {
        handlerStarts.push(index)
      }
    }

    if (
      handlerStarts.length === 0 ||
      handlerStarts.some((start, index) => {
        const handlerEnd = handlerStarts[index + 1] ?? end
        return !handlerPropagatesPermissionFailure(tokens.slice(start, handlerEnd))
      })
    ) {
      return true
    }
  }

  return false
}

type ExceptionBlock = {
  begin: number
  end: number
  exception?: number
}

function exceptionBlocks(tokens: SqlToken[]): ExceptionBlock[] {
  const blocks: ExceptionBlock[] = []
  const stack: Array<Omit<ExceptionBlock, "end">> = []

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].value === "begin") {
      stack.push({ begin: index })
      continue
    }
    if (
      tokens[index].value === "exception" &&
      tokens[index - 1]?.value !== "raise" &&
      stack.length > 0
    ) {
      stack[stack.length - 1].exception = index
      continue
    }
    if (
      tokens[index].value === "end" &&
      !["case", "if", "loop"].includes(tokens[index + 1]?.value)
    ) {
      const block = stack.pop()
      if (block !== undefined) {
        blocks.push({ ...block, end: index })
      }
    }
  }

  return blocks
}

/** Detects a swallowing handler attached to a block that encloses an operation. */
export function hasSwallowedPermissionExceptionAround(
  tokens: SqlToken[],
  operationIndex: number
): boolean {
  return exceptionBlocks(tokens).some(
    (block) =>
      block.begin < operationIndex &&
      operationIndex < (block.exception ?? block.end) &&
      block.exception !== undefined &&
      hasSwallowedPermissionException(tokens.slice(block.exception, block.end))
  )
}
