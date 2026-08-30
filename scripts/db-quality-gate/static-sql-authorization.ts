import type { SqlFunctionBlock } from "./static-policy-objects"
import { hasSwallowedPermissionExceptionAround } from "./static-sql-control-flow"
import { hasFailClosedJwtGuards } from "./static-sql-jwt"
import { hasCanonicalClaimsObjectGuard } from "./static-sql-jwt-canonical"
import { tokenizeSqlSegment } from "./static-sql-tokens"
import type { SqlToken } from "./static-sql-tokens"

function qualifiedFunctionTarget(tokens: SqlToken[], operationIndex: number): string | undefined {
  const operation = tokens[operationIndex]?.value
  if (!["call", "perform", "return"].includes(operation)) {
    return undefined
  }
  const cursor = operationIndex + 1
  if (
    tokens[cursor]?.type !== "word" ||
    tokens[cursor + 1]?.value !== "." ||
    tokens[cursor + 2]?.type !== "word" ||
    tokens[cursor + 3]?.value !== "("
  ) {
    return undefined
  }

  if (tokens[cursor + 4]?.value !== ")" || tokens[cursor + 5]?.value !== ";") {
    return undefined
  }

  return `${tokens[cursor].value}.${tokens[cursor + 2].value}`
}

function isFunctionInvocation(tokens: SqlToken[], index: number): boolean {
  return tokens[index].type === "word" && tokens[index + 1]?.value === "("
}

type DelegatedTarget = {
  name: string
  operationIndex: number
}

function firstDelegatedTarget(content: string): DelegatedTarget | undefined {
  const tokens = tokenizeSqlSegment(content)
  const beginIndex = tokens.findIndex((token) => token.value === "begin")
  if (beginIndex === -1) {
    return undefined
  }
  const declaration = tokens.slice(0, beginIndex)
  if (
    declaration.some((_, index) => isFunctionInvocation(declaration, index)) ||
    declaration.some((token) => ["=", ":=", "default"].includes(token.value))
  ) {
    return undefined
  }

  const operationIndex = beginIndex + 1
  const name = qualifiedFunctionTarget(tokens, operationIndex)

  return name === undefined ? undefined : { name, operationIndex }
}

/** Proves direct or transitive JWT authorization through unambiguous internal helpers. */
export function failClosedJwtAuthorizedFunctions(
  functionBlocks: SqlFunctionBlock[],
  isSafeInternalTarget: (functionBlock: SqlFunctionBlock) => boolean,
  allowsRoleClaimFallback: (functionBlock: SqlFunctionBlock) => boolean = () => false,
  availableFunctionBlocks = functionBlocks
): Set<SqlFunctionBlock> {
  const functionsByName = new Map<string, SqlFunctionBlock[]>()
  for (const functionBlock of availableFunctionBlocks) {
    const matches = functionsByName.get(functionBlock.name) ?? []
    matches.push(functionBlock)
    functionsByName.set(functionBlock.name, matches)
  }

  const authorized = new Set<SqlFunctionBlock>()
  const rejected = new Set<SqlFunctionBlock>()
  const visiting = new Set<SqlFunctionBlock>()

  const isAuthorized = (functionBlock: SqlFunctionBlock): boolean => {
    if (authorized.has(functionBlock)) {
      return true
    }
    if (rejected.has(functionBlock) || visiting.has(functionBlock)) {
      return false
    }
    if (
      hasFailClosedJwtGuards(functionBlock.body) ||
      hasCanonicalClaimsObjectGuard(functionBlock.body, {
        allowRoleClaimFallback: allowsRoleClaimFallback(functionBlock),
      })
    ) {
      authorized.add(functionBlock)
      return true
    }

    visiting.add(functionBlock)
    const bodyTokens = tokenizeSqlSegment(functionBlock.body)
    const delegation = firstDelegatedTarget(functionBlock.body)
    const targets = delegation === undefined ? undefined : functionsByName.get(delegation.name)
    const target =
      targets?.length === 1 && isSafeInternalTarget(targets[0]) ? targets[0] : undefined
    const result =
      target !== undefined &&
      delegation !== undefined &&
      !hasSwallowedPermissionExceptionAround(bodyTokens, delegation.operationIndex) &&
      isAuthorized(target)
    visiting.delete(functionBlock)

    if (result) {
      authorized.add(functionBlock)
    } else {
      rejected.add(functionBlock)
    }

    return result
  }

  for (const functionBlock of functionBlocks) {
    isAuthorized(functionBlock)
  }

  return authorized
}
