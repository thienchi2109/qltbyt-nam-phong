import type { SqlFunctionBlock } from "./static-policy-objects"
import { hasSwallowedPermissionExceptionAround } from "./static-sql-control-flow"
import { hasFailClosedJwtGuards } from "./static-sql-jwt"
import { hasCanonicalClaimsObjectGuard } from "./static-sql-jwt-canonical"
import { hasFailClosedSessionUserGuard } from "./static-sql-session-guard"
import { tokenizeSqlSegment } from "./static-sql-tokens"
import type { SqlToken } from "./static-sql-tokens"

type DelegatedTarget = {
  argumentNames: string[]
  name: string
  operationIndex: number
}

function qualifiedFunctionTarget(
  tokens: SqlToken[],
  operationIndex: number
): DelegatedTarget | undefined {
  const operation = tokens[operationIndex]?.value
  const callIndex =
    ["call", "perform", "return"].includes(operation) && tokens[operationIndex + 1]?.type === "word"
      ? operationIndex + 1
      : tokens[operationIndex]?.type === "word" &&
          ["=", ":="].includes(tokens[operationIndex + 1]?.value)
        ? operationIndex + 2
        : -1
  if (callIndex === -1) {
    return undefined
  }
  if (
    tokens[callIndex]?.type !== "word" ||
    tokens[callIndex + 1]?.value !== "." ||
    tokens[callIndex + 2]?.type !== "word" ||
    tokens[callIndex + 3]?.value !== "("
  ) {
    return undefined
  }

  const argumentNames: string[] = []
  let depth = 0
  let argumentStart = callIndex + 4
  let closingIndex = -1
  for (let index = argumentStart; index < tokens.length; index += 1) {
    if (tokens[index].value === "(") depth += 1
    if (tokens[index].value === ")" && depth === 0) {
      const argument = tokens.slice(argumentStart, index)
      if (argument.length > 0) {
        if (argument.length !== 1 || argument[0].type !== "word") return undefined
        argumentNames.push(argument[0].value)
      }
      closingIndex = index
      break
    }
    if (tokens[index].value === "," && depth === 0) {
      const argument = tokens.slice(argumentStart, index)
      if (argument.length !== 1 || argument[0].type !== "word") return undefined
      argumentNames.push(argument[0].value)
      argumentStart = index + 1
    }
    if (tokens[index].value === ")") depth -= 1
  }
  if (closingIndex === -1 || tokens[closingIndex + 1]?.value !== ";") {
    return undefined
  }

  return {
    argumentNames,
    name: `${tokens[callIndex].value}.${tokens[callIndex + 2].value}`,
    operationIndex,
  }
}

function isFunctionInvocation(tokens: SqlToken[], index: number): boolean {
  return tokens[index].type === "word" && tokens[index + 1]?.value === "("
}

function hasUnsafeDeclarationInitializer(tokens: SqlToken[]): boolean {
  for (let index = 0; index < tokens.length; index += 1) {
    if (!["=", ":=", "default"].includes(tokens[index].value)) continue
    const end = tokens.findIndex((token, cursor) => cursor > index && token.value === ";")
    const expression = tokens.slice(index + 1, end === -1 ? tokens.length : end)
    if (expression.map((token) => token.value).join(" ") !== "clock_timestamp ( )") return true
  }

  return false
}

function firstDelegatedTarget(content: string): DelegatedTarget | undefined {
  const tokens = tokenizeSqlSegment(content)
  const beginIndex = tokens.findIndex((token) => token.value === "begin")
  if (beginIndex === -1) {
    return undefined
  }
  const declaration = tokens.slice(0, beginIndex)
  if (
    hasUnsafeDeclarationInitializer(declaration) ||
    declaration.some(
      (_, index) =>
        isFunctionInvocation(declaration, index) &&
        declaration[index - 1]?.value !== "=" &&
        declaration[index - 1]?.value !== ":=" &&
        declaration[index - 1]?.value !== "default"
    )
  ) {
    return undefined
  }

  const operationIndex = beginIndex + 1
  return qualifiedFunctionTarget(tokens, operationIndex)
}

/** Identifies functions that form the internal authorization delegation graph. */
export function authorizationHelperIdentities(
  functionBlocks: SqlFunctionBlock[],
  availableFunctionBlocks = functionBlocks
): Set<string> {
  const functionsByName = new Map<string, SqlFunctionBlock[]>()
  for (const functionBlock of availableFunctionBlocks) {
    const matches = functionsByName.get(functionBlock.name) ?? []
    matches.push(functionBlock)
    functionsByName.set(functionBlock.name, matches)
  }
  const identities = new Set<string>()
  for (const functionBlock of functionBlocks) {
    const delegation = firstDelegatedTarget(functionBlock.body)
    const target =
      delegation === undefined
        ? undefined
        : delegatedFunction(functionBlock, delegation, functionsByName)
    if (target !== undefined) identities.add(target.identity)
  }
  for (const functionBlock of availableFunctionBlocks) {
    if (
      hasFailClosedJwtGuards(functionBlock.body) ||
      hasCanonicalClaimsObjectGuard(functionBlock.body) ||
      hasFailClosedSessionUserGuard(functionBlock.body)
    ) {
      identities.add(functionBlock.identity)
    }
  }

  return identities
}

function delegatedFunction(
  caller: SqlFunctionBlock,
  delegation: DelegatedTarget,
  functionsByName: Map<string, SqlFunctionBlock[]>
): SqlFunctionBlock | undefined {
  const callerArguments = new Map(
    caller.argumentNames.map((name, index) => [name, caller.argumentTypes[index]])
  )
  const types = delegation.argumentNames.map((name) => callerArguments.get(name))
  if (types.some((type) => type === undefined)) return undefined

  const targets = functionsByName.get(delegation.name) ?? []
  const matches = targets.filter(
    (target) =>
      target.argumentTypes.length === delegation.argumentNames.length &&
      target.argumentNames.every((name, index) => name === delegation.argumentNames[index]) &&
      target.argumentTypes.every((type, index) => type === types[index])
  )

  return matches.length === 1 ? matches[0] : undefined
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
      hasFailClosedSessionUserGuard(functionBlock.body) ||
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
    const target =
      delegation === undefined
        ? undefined
        : delegatedFunction(functionBlock, delegation, functionsByName)
    const result =
      target !== undefined &&
      isSafeInternalTarget(target) &&
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
