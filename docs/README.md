# Project Documentation

This directory contains technical documentation, architectural decisions, and implementation plans for the QLTB-YT Nam Phong project.

## Table of Contents

### Architecture & Design
- [Transfers Kanban Scalability Plan (Deferred)](./transfers-kanban-scalability-plan.md) - Performance and UX improvements for handling 100+ transfer requests

### Features & Enhancements
- Transfers Kanban Scalability - Phased plan to optimize Kanban board for large volumes without losing workflow context

### Performance & Optimization
- Column windowing and pagination strategies
- Density modes and saved views patterns
- LocalStorage-based user preferences

## Contributing

When adding new documentation:

1. Create a new `.md` file in the appropriate category
2. Add a link to this README
3. Follow the existing document structure (Context, Objectives, Implementation, etc.)
4. Include code examples and type definitions where relevant
5. Mark status clearly (Active, Deferred, Completed, Deprecated)

## Document Status Definitions

- **Active** - Currently being implemented or in use
- **Deferred** - Planned but not scheduled; awaiting prioritization
- **Completed** - Implementation finished and deployed
- **Deprecated** - No longer in use; kept for historical reference

---

**Last Updated:** October 9, 2025
