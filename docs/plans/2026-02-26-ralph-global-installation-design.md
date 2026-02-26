# Ralph Global Installation Design

## Context
- User request: fetch content from `https://github.com/snarktank/ralph` and install Ralph for Claude Code globally.
- Confirmed scope: global install (not repo-local only).
- Selected approach: **Direct Git clone + manual global skill install**.
- Source installation guidance confirmed from Ralph README:
  - `cp -r skills/prd ~/.claude/skills/`
  - `cp -r skills/ralph ~/.claude/skills/`

## Goal
Install Ralph skills in Claude Code global skill directory so they are available across all projects on this machine.

## Constraints
- Minimize risk to existing global skills.
- Keep workflow manual and transparent (no custom installer script).
- Use exact upstream structure from Ralph repo.

## Approaches Considered

### 1) Direct clone + manual install (**Selected**)
- Clone Ralph repository locally.
- Copy `skills/prd` and `skills/ralph` into `~/.claude/skills/`.
- Pros: simple, transparent, easy to audit and rollback.
- Cons: manual update process.

### 2) Marketplace plugin install
- Use Claude Code plugin commands:
  - `/plugin marketplace add snarktank/ralph`
  - `/plugin install ralph-skills@ralph-marketplace`
- Pros: potentially simpler update path.
- Cons: depends on marketplace plugin flow and package availability.

### 3) Repo-local scripts only
- Use `scripts/ralph/ralph.sh` + `scripts/ralph/CLAUDE.md` in a single repository.
- Pros: isolated per project.
- Cons: does not satisfy global availability requirement.

## Selected Architecture

### Components
- **Source repo:** cloned checkout of `snarktank/ralph`.
- **Target directories:**
  - `~/.claude/skills/prd`
  - `~/.claude/skills/ralph`
- **Safety backup directory:** `~/.claude/skills-backup/` (timestamped backups before overwrite).

### Data/Execution Flow
1. Verify prerequisites (`claude`, `git`, `jq`).
2. Clone Ralph into a temporary directory.
3. Backup existing `~/.claude/skills/prd` and `~/.claude/skills/ralph` if present.
4. Copy upstream skill folders into `~/.claude/skills/`.
5. Verify resulting directory structure exists and is readable.
6. Smoke-test skill availability inside Claude Code session.

## Error Handling and Rollback
- If copy fails, restore previous backup directories from `~/.claude/skills-backup/`.
- If upstream structure changes, stop and inspect cloned repo before copying.
- If prerequisites are missing, install them first and rerun preflight checks.

## Verification Plan
1. `ls ~/.claude/skills/prd` returns files.
2. `ls ~/.claude/skills/ralph` returns files.
3. Claude Code can discover and invoke Ralph-related skills after installation.

## Out of Scope
- Building a custom installer.
- Auto-update mechanism.
- Project-local Ralph script setup for this repository.
