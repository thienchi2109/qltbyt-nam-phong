# Skipping Lint Check Rule

## Context

In certain development scenarios, you may choose to skip the lint check to speed up the build or deployment process, especially during iterative development and testing phases.

### Rule:
- When explicitly specified, omit `npm run lint` or equivalent commands from the build or deployment scripts.
- Ensure that lint checks are performed periodically to catch issues before merging to main branches.

### Additional Considerations:
- Always ensure code quality and style consistency before any major release
- Consider automating lint checks in CI/CD pipelines to ensure compliance
- Update documentation accordingly to reflect any process changes regarding lint checks

