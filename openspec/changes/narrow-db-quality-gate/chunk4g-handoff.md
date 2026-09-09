# Chunk 4g — Equipment filter buckets

Base: `50282fe26b3b2fa5302ac65ca5e67aba1ca59453`; only classification entry 12.

- Core-security: cross-tenant/deleted exclusion, role-user department scope even
  when own filter is excluded, and blank `khoa_phong` fail-closed buckets.
- Migration-specific: payload shape, status/search filtering, fallback-label
  cascade, and consistency with list/distribution RPCs.
- Original mixed test and active registry remain unchanged; companions are
  fixture-only. RED then GREEN; focused 4a–4g suite: 34/34 tests PASS.
- Format, explicit-any, dedupe and typecheck PASS. React Doctor reports no
  changed source files (SQL/test scope only). No Oracle/live DB or DB aggregate
  PASS; Chunk 5/6 not started.

## TODO

- [ ] User review 4g and future migration mapping/cutover.
- [ ] Dynamic semantic validation in Chunk 7.
