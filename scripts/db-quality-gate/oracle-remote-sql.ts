type TopLevelSqlStatement = {
  normalized: string
  end: number
  start: number
}

function topLevelSqlMask(content: string): string {
  const masked = content.split("")

  function hide(start: number, end: number): void {
    for (let index = start; index < end; index += 1) {
      if (masked[index] !== "\n" && masked[index] !== "\r") {
        masked[index] = " "
      }
    }
  }

  let index = 0
  while (index < content.length) {
    const current = content[index]
    if (current === "'") {
      const start = index
      index += 1
      while (index < content.length) {
        if (content[index] === "\\") {
          index += 2
        } else if (content[index] === "'") {
          if (content[index + 1] === "'") {
            index += 2
            continue
          }
          index += 1
          break
        } else {
          index += 1
        }
      }
      hide(start, index)
      continue
    }

    if (current === '"') {
      const start = index
      index += 1
      while (index < content.length) {
        if (content[index] === '"') {
          if (content[index + 1] === '"') {
            index += 2
            continue
          }
          index += 1
          break
        } else {
          index += 1
        }
      }
      hide(start, index)
      continue
    }

    if (content.startsWith("--", index)) {
      const start = index
      index = content.indexOf("\n", index)
      if (index === -1) {
        index = content.length
      }
      hide(start, index)
      continue
    }

    if (content.startsWith("/*", index)) {
      const start = index
      let depth = 1
      index += 2
      while (index < content.length && depth > 0) {
        if (content.startsWith("/*", index)) {
          depth += 1
          index += 2
        } else if (content.startsWith("*/", index)) {
          depth -= 1
          index += 2
        } else {
          index += 1
        }
      }
      hide(start, index)
      continue
    }

    const dollarTag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u.exec(content.slice(index))?.[0]
    if (dollarTag !== undefined) {
      const start = index
      const closingIndex = content.indexOf(dollarTag, index + dollarTag.length)
      index = closingIndex === -1 ? content.length : closingIndex + dollarTag.length
      hide(start, index)
      continue
    }

    index += 1
  }

  return masked.join("")
}

function topLevelSqlStatements(content: string): TopLevelSqlStatement[] | undefined {
  const masked = topLevelSqlMask(content)
  if (/(?:^|\n)[\t \r]*\\/u.test(masked)) {
    return undefined
  }

  const statements: TopLevelSqlStatement[] = []
  let start = 0
  for (let index = 0; index < masked.length; index += 1) {
    if (masked[index] !== ";") {
      continue
    }

    const normalized = masked.slice(start, index).trim().replaceAll(/\s+/g, " ").toUpperCase()
    if (normalized.length > 0) {
      statements.push({
        end: index + 1,
        normalized,
        start,
      })
    }
    start = index + 1
  }

  return masked.slice(start).trim().length === 0 ? statements : undefined
}

/** Reports whether a psql meta command exists outside strings and SQL comments. */
export function hasPsqlMetaCommand(content: string): boolean {
  return /(?:^|\n)[\t \r]*\\/u.test(topLevelSqlMask(content))
}

function hasSafeSavepointControl(statements: TopLevelSqlStatement[]): boolean {
  const savepoints: string[] = []
  const savepointName = "([A-Z_][A-Z0-9_$]*)"
  const savepointPattern = new RegExp(`^SAVEPOINT ${savepointName}$`, "u")
  const rollbackPattern = new RegExp(`^ROLLBACK TO(?: SAVEPOINT)? ${savepointName}$`, "u")
  const releasePattern = new RegExp(`^RELEASE(?: SAVEPOINT)? ${savepointName}$`, "u")
  const transactionControl =
    /^(?:BEGIN|START TRANSACTION|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE(?: SAVEPOINT)?|PREPARE TRANSACTION|SET TRANSACTION)\b/u

  for (const statement of statements) {
    const savepoint = savepointPattern.exec(statement.normalized)?.[1]
    if (savepoint !== undefined) {
      savepoints.push(savepoint)
      continue
    }

    const rollback = rollbackPattern.exec(statement.normalized)?.[1]
    if (rollback !== undefined) {
      const index = savepoints.lastIndexOf(rollback)
      if (index === -1) {
        return false
      }
      savepoints.splice(index + 1)
      continue
    }

    const release = releasePattern.exec(statement.normalized)?.[1]
    if (release !== undefined) {
      const index = savepoints.lastIndexOf(release)
      if (index === -1) {
        return false
      }
      savepoints.splice(index)
      continue
    }

    if (transactionControl.test(statement.normalized)) {
      return false
    }
  }

  return true
}

/** Removes the declared rollback envelope and accepts only scoped top-level savepoint control. */
export function rollbackRequiredSqlTestBody(content: string): string | undefined {
  const statements = topLevelSqlStatements(content)
  if (statements === undefined || statements.length < 2) {
    return undefined
  }

  const first = statements[0]
  const last = statements.at(-1)
  if (
    last === undefined ||
    !/^(?:BEGIN|START TRANSACTION)$/u.test(first.normalized) ||
    last.normalized !== "ROLLBACK"
  ) {
    return undefined
  }

  if (!hasSafeSavepointControl(statements.slice(1, -1))) {
    return undefined
  }

  return content.slice(first.end, last.start).trim()
}

/** Normalizes the one supported psql directive and validates the shared rollback contract. */
export function registeredSqlTestBody(content: string): string | undefined {
  const normalizedContent = content.replace(/^\\set ON_ERROR_STOP on(?:\r?\n|$)/u, "")
  return normalizedContent.trim().length === 0
    ? undefined
    : rollbackRequiredSqlTestBody(normalizedContent)
}
