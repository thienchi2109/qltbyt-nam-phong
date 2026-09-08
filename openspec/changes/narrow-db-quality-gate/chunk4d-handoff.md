# Chunk 4d — Equipment department distribution

Base: `5163f5f1`; only classification entry 9. The original mixed test and
active registry remain unchanged; staged companions are fixture-only.

- Core-security: role-user `don_vi` + `khoa_phong` scoping and the one-bucket
  isolation witness. Fixture inserts are setup, not security coverage.
- Migration-specific: Ngoai=2, Noi=1, missing department label=1, and selected
  department filter result=1.
- RED showed scope leakage before extraction; GREEN is 30/30 across the focused
  4a–4d, registry and metadata suite. Explicit-any, dedupe, typecheck and
  React Doctor (100/100) pass; no Oracle/live DB.
- TODO: user review; dynamic semantic validation in Chunk 7; do not start
  Chunk 5/6. Existing sentinel/exception hardening remains issue #993.
