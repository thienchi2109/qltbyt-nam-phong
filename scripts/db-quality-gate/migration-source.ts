import { sha256Text } from "./serialization"

/** Removes exactly one trailing LF so migration identity is newline-stable. */
export function canonicalizeMigrationContent(content: string): string {
  return content.endsWith("\n") ? content.slice(0, -1) : content
}

/** Hashes migration content after the one-terminal-LF normalization. */
export function migrationContentSha256(content: string): string {
  return sha256Text(canonicalizeMigrationContent(content))
}
