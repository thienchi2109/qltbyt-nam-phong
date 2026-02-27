# GKG Troubleshooting (Project: qltbyt-nam-phong)

Last validated: 2026-02-27

## Issue

GitLab Knowledge Graph (GKG) may miss expected React component definitions from `.tsx` files in this repository, even after re-indexing.

Observed pattern:
- `.ts` symbols are discoverable via `search_codebase_definitions`.
- many `.tsx` component symbols are not returned.
- index stats report significantly fewer indexed TypeScript files than repository TS/TSX source count.

## Quick Repro

1. Run `index_project` for `E:\qltbyt-nam-phong`.
2. Query a known `.ts` symbol such as `toKeyedTexts`:
   - expected: found.
3. Query a known `.tsx` symbol such as `DashboardTabs`:
   - expected: may be missing.

## Required Fallback Flow

When expected symbols are missing after one re-index:

1. Use `warpgrep` for semantic discovery:
   - "Find where `<symbol>` is defined and used in runtime app code."
2. Use `rg` for exact matches:
   - definition: `rg -n --hidden -S "export function <Symbol>|const <Symbol>" src`
   - usage: `rg -n --hidden -S "<Symbol>|@/path/to/file" src`
3. Verify impact with direct file reads.
4. In the final response, state that GKG results were incomplete and fallback was used.

## Notes

- Do not block work waiting for GKG completeness.
- Keep GKG as first-step discovery, but treat misses for React `.tsx` symbols as non-authoritative in this environment.
