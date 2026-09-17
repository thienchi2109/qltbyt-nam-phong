import fs from "node:fs"

export function createCleanup({
  check,
  compose,
  composeProjects,
  containers,
  docker,
  redactSecrets,
  tempDir,
}) {
  function removeContainer(name) {
    if (!name || !containers.has(name)) return
    let lastError
    let commandFailure = false
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const removal = docker(["rm", "-f", name])
      const remaining = docker(["inspect", name])
      if (remaining.status === null) {
        throw new Error(`remove ${name}: cleanup verification command did not start`)
      }
      if (remaining.status !== 0) {
        containers.delete(name)
        if (removal.status !== 0 || commandFailure)
          throw new Error(`remove ${name}: cleanup command failed after resource removal`)
        check(true, `container ${name} cleanup verified`)
        return
      }
      commandFailure ||= removal.status !== 0
      lastError = new Error(
        `remove ${name}: container remains after cleanup attempt ${attempt + 1}`
      )
    }
    throw lastError
  }

  function cleanupComposeProject(project) {
    const record = composeProjects.get(project)
    if (!record) return
    let lastError
    let commandFailure = false
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const down = compose([...record.base, "down", "--remove-orphans"], {
        env: record.env,
      })
      const remaining = compose([...record.base, "ps", "-q"], { env: record.env })
      const containersRemaining = docker([
        "ps",
        "-aq",
        "--filter",
        `label=com.docker.compose.project=${project}`,
      ])
      const networksRemaining = docker([
        "network",
        "ls",
        "-q",
        "--filter",
        `label=com.docker.compose.project=${project}`,
      ])
      if (
        remaining.status === 0 &&
        !(remaining.stdout || "").trim() &&
        containersRemaining.status === 0 &&
        !(containersRemaining.stdout || "").trim() &&
        networksRemaining.status === 0 &&
        !(networksRemaining.stdout || "").trim()
      ) {
        composeProjects.delete(project)
        if (down.status !== 0 || commandFailure) {
          throw new Error(`compose ${project} cleanup command failed after resource removal`)
        }
        check(true, `compose ${project} cleanup verified`)
        return
      }
      commandFailure ||= down.status !== 0
      lastError = new Error(
        `compose ${project} resources remain after cleanup attempt ${attempt + 1}`
      )
    }
    throw lastError
  }

  function cleanupResources() {
    const errors = []
    for (const name of [...containers]) {
      try {
        removeContainer(name)
      } catch (error) {
        errors.push(redactSecrets(error?.message || error))
      }
    }
    for (const project of [...composeProjects.keys()]) {
      try {
        cleanupComposeProject(project)
      } catch (error) {
        errors.push(redactSecrets(error?.message || error))
      }
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
      if (fs.existsSync(tempDir)) throw new Error("temporary directory remains")
    } catch (error) {
      errors.push(redactSecrets(error?.message || error))
    }
    if (errors.length > 0) throw new Error(errors.join("; "))
  }

  return { cleanupComposeProject, cleanupResources, removeContainer }
}
