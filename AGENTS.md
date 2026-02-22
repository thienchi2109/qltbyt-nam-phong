# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

**FAST APPLY:** 
IMPORTANT: Use `edit_file` over `str_replace` or full file writes. It works with partial code snippets—no need for full file content.


**WARP GREP:** 
- warp-grep is a subagent that takes in a search string and tries to find relevant context. Best practice is to use it at the beginning of codebase explorations to fast track finding relevant files/lines. 
- Do not use it to pin point keywords, but use it for broader semantic queries. "Find the XYZ flow", "How does XYZ work", "Where is XYZ handled?", "Where is <error message> coming from?"

## Skill Enforcement

- For any task that generates or materially edits TypeScript/React code (`.ts`, `.tsx`, React components, hooks, client/server UI logic), you MUST invoke the `react-best-practices` skill first (or `vercel-react-best-practices` if that is the available skill name in the session).
- For any task that creates or modifies SQL migration files/DDL for Supabase/Postgres, you MUST invoke the `supabase-best-practices` skill first (or `supabase-postgres-best-practices` if that is the available skill name in the session).
- If a required skill is unavailable in the current session, state that explicitly and proceed with the closest available fallback guidance.


## 🎓 Summary for AI

**You are working on an equipment management system. You have access to a knowledge graph that understands the codebase structure.**

**Your job:**
- Use GKG to navigate and understand code architecture
- Combine GKG insights with code reading for complete understanding
- Always check impact before suggesting changes
- Be efficient: use the right tool for each task
- Help user make informed decisions about their codebase

**Remember:** GKG shows you "what" and "where". You still need to read code to understand "how" and "why".

## 🛠️ Available Tools & MCP Servers

### GitLab Knowledge Graph (GKG)

This project is indexed with **GitLab Knowledge Graph MCP**. You have access to the following tools:

#### When to Use GKG:

#### Enforcement Rules (MUST FOLLOW):
- Start code discovery with GKG tools whenever the task requires finding definitions, references, relationships, or impact.
- Before proposing or applying non-trivial code changes, run GKG impact checks (`search_codebase_definitions` + `get_references`) unless the user explicitly scoped exact files.
- If GKG is skipped, explicitly state why (for example: direct file-path request, simple grep task, or config lookup).
- If GKG is unavailable or failing, explicitly state that and use fallback methods (`warpgrep`/`rg` + direct code reading).

**✅ ALWAYS use GKG for:**
- Finding where functions/classes are defined
- Understanding code structure and relationships
- Discovering what calls/uses a specific function
- Mapping dependencies between modules
- Finding all implementations of an interface/class
- Impact analysis ("what breaks if I change X?")
- Locating test files for specific code

**❌ DON'T use GKG for:**
- Understanding business logic flow (use code reading instead)
- Finding configuration values (just read config files)
- Simple grep tasks (e.g., "find string 'TODO'")
- When user explicitly asks to read specific files

#### Available GKG Tools:

1. **`list_projects`**
   - Lists all indexed projects in knowledge graph
   - Use when: User asks "what projects do you have access to?"

2. **`search_codebase_definitions`**
   - Search for functions, classes, methods, types, interfaces
   - Parameters: `query` (string), `project_name` (optional)
   - Example: Find all controller classes, locate UserService, find calculatePrice function
   - **Use this FIRST** when user asks about specific code elements

3. **`get_references`**
   - Find all places where a definition is used/called
   - Parameters: `uri` (from search results), `project_name`
   - Example: "What calls this function?", "Where is this class used?"
   - **Critical for impact analysis**

4. **`get_definition`**
   - Get full details of a specific definition
   - Parameters: `uri` (from search results), `project_name`
   - Returns: Code location, signature, documentation
   - Use when: Need exact implementation details

5. **`reindex_project`**
   - Refresh knowledge graph after code changes
   - Only use if: User reports stale/missing results
   - Note: Requires GKG server restart

---

## 🎯 Workflow Patterns

### Pattern 1: Understanding a Feature

**User asks:** "How does equipment transfer work?"

**Your approach:**
```
1. search_codebase_definitions(query="transfer", project_name="qltbyt-nam-phong")
   → Find TransferController, TransferService, Transfer model

2. For each result:
   - get_definition() to see implementation
   - get_references() to see what uses it

3. Read actual code files to understand business logic

4. Synthesize findings into clear explanation
```

### Pattern 2: Impact Analysis

**User asks:** "If I modify Device.calculatePrice(), what will break?"

**Your approach:**
```
1. search_codebase_definitions(query="calculatePrice")
   → Find Device.calculatePrice definition

2. get_references(uri=<device_calculate_price_uri>)
   → Get list of all callers

3. For each caller:
   - Check if it's a test (tests usually safe to update)
   - Check if it's in critical path (controllers, services)
   - Assess impact level

4. Provide comprehensive impact report
```

### Pattern 3: Code Navigation

**User asks:** "Show me all API routes for devices"

**Your approach:**
```
1. search_codebase_definitions(query="DeviceController OR DeviceRoutes")
   → Find route definitions

2. get_definition() for each route file
   → See actual route mappings

3. Present organized list with HTTP methods and paths
```

### Pattern 4: Finding Related Code

**User asks:** "What tests exist for UserService?"

**Your approach:**
```
1. search_codebase_definitions(query="UserService")
   → Find UserService class

2. get_references(uri=<user_service_uri>)
   → Filter results for files in tests/ directory

3. List all test files with their paths
```

---

**Key conventions:**
- Controllers handle HTTP requests/responses only
- Services contain business logic
- Models define data structure and DB operations
- All async operations use async/await (no callbacks)

---


## 🔍 Common Tasks & Solutions

### Task: Add a new feature

**Steps:**
1. Use GKG to find similar existing features:
   ```
   search_codebase_definitions(query="similar_feature_name")
   ```

2. Analyze structure with get_definition() and get_references()

3. Follow the same pattern:
   - Create model (if needed)
   - Create service with business logic
   - Create controller for API endpoints
   - Add tests

4. Check impact on existing code with get_references()

### Task: Debug an issue

**Steps:**
1. Find the problematic code:
   ```
   search_codebase_definitions(query="function_or_class_name")
   ```

2. Trace callers:
   ```
   get_references(uri=<definition_uri>)
   ```

3. Read code flow to understand context

4. Check related tests

### Task: Refactor code

**Steps:**
1. Find all usages FIRST:
   ```
   search_codebase_definitions(query="target")
   get_references(uri=<target_uri>)
   ```

2. Assess impact (how many files affected?)

3. Plan changes to minimize breakage

4. Update tests alongside code

---

## ⚠️ Important Notes

### When User Provides File Paths:
- If user says "check src/controllers/device.ts", **read the file directly**
- Don't use GKG for files user explicitly mentions
- GKG is for discovery, not for reading known files

### Performance Optimization:
- Use `search_codebase_definitions` liberally - it's fast (<100ms)
- Combine multiple GKG queries in parallel when possible
- Cache GKG results during conversation (don't re-query same thing)

### Handling "Not Found" Results:
- If GKG returns empty, the code might not exist yet
- Suggest to user that feature may need to be implemented
- Or code might be in a different project/repo

### Multi-Project Scenarios:
- This workspace may have multiple indexed projects
- Use `list_projects` if unsure which project user refers to
- Always specify `project_name` parameter when known

---

## 🚀 Best Practices for AI

### DO:
✅ Use GKG as first step for code discovery
✅ Use GKG MCP tools whenever possible and necessary
✅ Combine GKG (structure) + code reading (logic)
✅ Always check references before suggesting changes
✅ Be specific with search queries
✅ Present organized, actionable results

### DON'T:
❌ Don't read all files manually when GKG can find them
❌ Don't suggest code changes without impact analysis
❌ Don't assume code location without searching
❌ Don't ignore GKG results in favor of assumptions
❌ Don't over-use GKG for simple tasks (reading config, etc.)
❌ Don't skip GKG for discovery/impact tasks without a stated reason
