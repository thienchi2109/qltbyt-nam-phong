# TM-02 — Monitoring configuration and effective versions

- Status: Todo
- Milestone: Temperature Monitoring / Foundation
- Depends on: TM-01
- Master spec: `docs/specs/temperature-monitoring.md`

## Goal

Allow an authorized user to configure monitoring per equipment without changing historical interpretation.

## Scope

- Opt-in monitoring flag and effective-dated configuration versions.
- Celsius lower/upper limits, schedule reference, responsible person and recording method.
- Validation of physical input range and configuration date overlaps.
- Tenant/department/RBAC enforcement and audit of configuration changes.

## Acceptance criteria

- A device can have one effective configuration at a time and a traceable version history.
- Historical readings can resolve the threshold snapshot that was effective at measurement time.
- Unauthorized users cannot create, edit or read configurations outside their equipment scope.
- Invalid ranges, overlapping effective periods and missing responsible/method data fail with actionable errors.

## Takeover gate

The takeover agent must survey current equipment profile/configuration seams, role helpers, schema conventions and test patterns, then write and review a detailed TM-02 plan before implementation.
