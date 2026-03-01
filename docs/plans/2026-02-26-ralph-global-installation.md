# Ralph Global Installation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Install Ralph globally for Claude Code by copying upstream skills into `~/.claude/skills` with backup and verification steps.

**Architecture:** Use a temporary clone of `snarktank/ralph` as source-of-truth, back up existing global skill folders, then copy `skills/prd` and `skills/ralph` into Claude Code global skills directory. Validate by checking directory contents and running a Claude Code smoke test.

**Tech Stack:** Git, Bash shell, Claude Code global skill directory, Ralph upstream repository.

---

### Task 1: Preflight and backup existing global skills

**Files:**
- Create: `~/.claude/skills-backup/` (global machine path)
- Verify: `~/.claude/skills/`
- Design reference: `docs/plans/2026-02-26-ralph-global-installation-design.md`

**Step 1: Verify prerequisites are installed**

```bash
claude --version
git --version
jq --version
```

**Step 2: Run preflight and confirm expected output**

Run: `claude --version && git --version && jq --version`
Expected: all three commands print versions and exit successfully.

**Step 3: Create backup directory**

```bash
mkdir -p ~/.claude/skills-backup
```

**Step 4: Back up existing Ralph-related skill folders (if present)**

```bash
TS="$(date +%Y%m%d%H%M%S)"
[ -d ~/.claude/skills/prd ] && mv ~/.claude/skills/prd ~/.claude/skills-backup/prd-$TS || true
[ -d ~/.claude/skills/ralph ] && mv ~/.claude/skills/ralph ~/.claude/skills-backup/ralph-$TS || true
```

**Step 5: Verify backups and current target state**

Run: `ls ~/.claude/skills-backup`
Expected: backup entries appear if prior folders existed.

---

### Task 2: Fetch Ralph source repository

**Files:**
- Create: `~/tmp/ralph/` (temporary clone path)
- Verify: `~/tmp/ralph/README.md`

**Step 1: Clone the upstream Ralph repository**

```bash
mkdir -p ~/tmp
git clone https://github.com/snarktank/ralph ~/tmp/ralph
```

**Step 2: Verify repository was fetched**

Run: `ls ~/tmp/ralph`
Expected: includes `README.md` and `skills/` directory.

**Step 3: Verify required skill folders exist in source**

Run: `ls ~/tmp/ralph/skills`
Expected: includes `prd` and `ralph`.

---

### Task 3: Install Ralph globally for Claude Code

**Files:**
- Modify/Create: `~/.claude/skills/prd`
- Modify/Create: `~/.claude/skills/ralph`
- Source: `~/tmp/ralph/skills/prd`, `~/tmp/ralph/skills/ralph`

**Step 1: Ensure Claude global skills directory exists**

```bash
mkdir -p ~/.claude/skills
```

**Step 2: Copy Ralph skills into global Claude skills directory**

```bash
cp -r ~/tmp/ralph/skills/prd ~/.claude/skills/
cp -r ~/tmp/ralph/skills/ralph ~/.claude/skills/
```

**Step 3: Verify copied directories**

Run: `ls ~/.claude/skills`
Expected: contains both `prd` and `ralph`.

**Step 4: Verify copied folder contents**

Run: `ls ~/.claude/skills/prd && ls ~/.claude/skills/ralph`
Expected: each directory lists skill files (non-empty).

---

### Task 4: Smoke-test and rollback criteria

**Files:**
- Verify: `~/.claude/skills/prd`
- Verify: `~/.claude/skills/ralph`
- Backup source (if needed): `~/.claude/skills-backup/*`

**Step 1: Open Claude Code and run a skill discovery/smoke check**
- In Claude Code, start a new session and trigger skill usage flow.
- Confirm Ralph-related skills are available for invocation.

**Step 2: If smoke test fails, restore backup directories**

```bash
# Example: restore latest backup manually by moving backup folders back into ~/.claude/skills
ls ~/.claude/skills-backup
```

Expected: backup entries are available for manual restore.

**Step 3: Optional cleanup of temporary clone**

```bash
rm -rf ~/tmp/ralph
```

Expected: temporary source clone removed.

---

## Upstream command references (from Ralph README)

```bash
cp -r skills/prd ~/.claude/skills/
cp -r skills/ralph ~/.claude/skills/
```

```bash
/plugin marketplace add snarktank/ralph
/plugin install ralph-skills@ralph-marketplace
```
