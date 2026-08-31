# Thong tu 10/2026 source freeze

This directory is the repository-owned Phase 0 source snapshot for the
appendix of Thong tu 10/2026/TT-BYT.

`manifest.json` is the freeze contract. It records the document identity,
issued/effective dates, `ready` status, extraction revision, source file
digests, structural completeness counts, and representation rules.

The PDF remains the legal ground truth. The JSON and Markdown files are
traceable structural transcriptions. The JSON keeps the 42 rows in source
order, including five section rows and 37 item rows. Item quota text remains
an array of source lines; it is not converted to an inferred formula.

The source-only test under `tests/device-quota/` checks that the checked-in
files still match this manifest and that all declared completeness invariants
hold. This snapshot is not imported or exposed by application runtime code in
Phase 0.
