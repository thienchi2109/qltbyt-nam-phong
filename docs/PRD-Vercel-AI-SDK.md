# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Project
**Vercel AI SDK Strategic Spec Alignment for qltbyt-nam-phong**

---

## 1. Introduction / Overview

This PRD defines a **strategic, architecture-aligned** plan for integrating a Vercel AI SDK assistant into the Vietnamese Medical Equipment Management System (`qltbyt-nam-phong`).

The objective is to align product requirements with the **actual current codebase state** and strict security model:
- Next.js App Router + React + TypeScript
- NextAuth JWT session model
- RPC-only database access via `/api/rpc/[fn]`
- Tenant isolation enforced by server-side claims and RPC rules

For v1, the assistant scope is intentionally constrained to:
1. **Read-only operational assistance** (equipment, maintenance, repair insights)
2. **Draft generation only** for repair request data structures (no direct write actions)
3. **No file/image attachments**
4. **Global chat panel in protected app layout** (not page-specific only)
5. **Provider-agnostic usage of Vercel AI SDK**

This PRD is designed to be implementation-ready while preserving system safety and tenant boundaries.

---

## 2. Goals

- Align AI assistant requirements with existing architecture and security constraints.
- Provide a global assistant entry point for authenticated users across protected pages.
- Ensure all AI data access follows RPC-only, tenant-safe patterns.
- Enable draft repair-request JSON generation without direct mutation of business data.
- Establish clear acceptance criteria and non-goals to prevent scope creep.

---

## 3. User Stories

### US-001: Add global assistant shell entry
**Description:** As an authenticated user, I want a global AI assistant panel in the protected app layout so that I can access contextual help from anywhere in the app.

**Acceptance Criteria:**
- [ ] A chat trigger and panel are rendered from the protected layout layer (`src/app/(app)/layout.tsx`) and available on protected routes.
- [ ] Panel is hidden for unauthenticated sessions.
- [ ] Input controls are disabled while request status is not `ready`.
- [ ] No file upload UI is present in v1.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-002: Secure chat API route with session enforcement
**Description:** As a system administrator, I want all AI chat requests validated against NextAuth session state so that unauthenticated access is blocked.

**Acceptance Criteria:**
- [ ] `/api/chat` route validates session using server-side NextAuth config before processing.
- [ ] Unauthenticated requests return 401/403 and do not call model/provider.
- [ ] Request schema validates chat payload and rejects malformed input.
- [ ] Typecheck/lint passes.

### US-003: Enforce RPC-only tool data access
**Description:** As a security owner, I want AI tools to read data only through approved RPC pathways so that tenant isolation remains intact.

**Acceptance Criteria:**
- [ ] Tool implementations do not query Supabase tables directly (`supabase.from(...)` in AI tool execution path is disallowed).
- [ ] Tool calls route through approved RPC functions with tenant-aware parameters.
- [ ] Tool registry uses explicit allowlist mapping (no arbitrary function invocation).
- [ ] Typecheck/lint passes.

### US-004: Tenant-aware context propagation
**Description:** As a multi-tenant user, I want assistant answers aligned with my current tenant/facility context so that AI results match what I am viewing.

**Acceptance Criteria:**
- [ ] Client sends current tenant/facility context (from existing tenant selection state) in chat request metadata.
- [ ] Server applies role-aware tenant handling rules consistent with existing security model.
- [ ] For privileged roles without selected facility where required, assistant returns guidance instead of broad unsafe data retrieval.
- [ ] Typecheck/lint passes.

### US-005: Read-only domain tools for operational Q&A
**Description:** As a technician or equipment manager, I want AI to answer questions using current equipment/maintenance/repair data so that I can act faster.

**Acceptance Criteria:**
- [ ] Minimum v1 toolset includes read-only operations for equipment lookup and maintenance/repair summaries.
- [ ] Tool descriptions and schemas are explicit and constrained.
- [ ] Assistant responses clearly distinguish retrieved facts vs. model inference.
- [ ] Typecheck/lint passes.

### US-006: Draft repair request object generation (no submission)
**Description:** As a user creating repair requests, I want AI to generate a structured draft from natural language so that I can prefill forms faster without automatic writes.

**Acceptance Criteria:**
- [ ] Assistant can produce structured draft payload for repair request form fields.
- [ ] Draft output is validated against a defined schema (e.g., Zod).
- [ ] Draft generation does not call create/update/delete RPCs.
- [ ] User must manually review and submit via existing form workflows.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

### US-007: Provider-agnostic AI SDK integration contract
**Description:** As a platform maintainer, I want the assistant integration to remain provider-agnostic so that provider choice can change without major rewrites.

**Acceptance Criteria:**
- [ ] AI route and chat layer are implemented via Vercel AI SDK abstractions, not provider-specific client logic in UI.
- [ ] Provider selection is configured via environment/config layer.
- [ ] PRD and code avoid hard-coding provider-specific assumptions into product behavior.
- [ ] Typecheck/lint passes.

### US-008: Auditable error handling and safe fallback behavior
**Description:** As an operator, I want safe, predictable failures so that users receive guidance without data leakage.

**Acceptance Criteria:**
- [ ] API returns user-safe error messages; sensitive internals are not leaked in client responses.
- [ ] Chat UI displays failure state and retry affordance.
- [ ] Tenant-selection-missing scenarios return explicit Vietnamese guidance message.
- [ ] Typecheck/lint passes.
- [ ] Verify in browser using dev-browser skill.

---

## 4. Functional Requirements

- **FR-1:** The system must provide a global assistant panel in protected layout routes.
- **FR-2:** The system must authenticate all chat requests server-side before any model/tool execution.
- **FR-3:** The assistant must use Vercel AI SDK chat primitives for streaming responses.
- **FR-4:** The assistant must support read-only domain tools for equipment, maintenance, and repair-related retrieval.
- **FR-5:** AI tool execution must use approved RPC functions only and must not query tables directly.
- **FR-6:** The assistant must enforce tenant-aware behavior using role and facility context consistent with existing app rules.
- **FR-7:** The assistant must support structured repair-request draft generation without direct writes.
- **FR-8:** The UI must disable input and submit while responses are streaming/not ready.
- **FR-9:** v1 must exclude file/image/document attachments in both UI and API.
- **FR-10:** The integration must remain provider-agnostic at product requirement level.
- **FR-11:** The assistant must return explicit guidance when required tenant context is missing.
- **FR-12:** Errors must be handled without exposing secrets, credentials, or internal infrastructure details.

---

## 5. Non-Goals (Out of Scope)

- Direct create/update/delete business actions performed by the assistant.
- Automatic submission of repair requests generated by AI drafts.
- File/image/PDF attachments and multimodal analysis in v1.
- Replacing existing module UIs (equipment, maintenance, repair pages) with AI-first workflows.
- Introducing direct table access or bypassing `/api/rpc/[fn]` security gateway patterns.
- Provider lock-in decisions at PRD level.

---

## 6. Design Considerations

- Reuse existing design system components (Radix + Tailwind) and layout conventions.
- Keep assistant entry point consistent with current app shell behavior in `src/app/(app)/layout.tsx`.
- Ensure mobile usability of the global panel without interfering with existing footer navigation.
- Keep Vietnamese-first UX copy, with concise and operationally useful responses.
- Maintain clear visual distinction between:
  - retrieved factual data,
  - generated draft content,
  - and error/guidance states.

---

## 7. Technical Considerations

- Existing tenant selection state is managed via `TenantSelectionContext` and must be respected in assistant context.
- Security-critical conventions from project `CLAUDE.md` apply:
  - RPC-only data access,
  - tenant isolation,
  - no trust of client-supplied tenant identity without server-side enforcement.
- Existing RPC gateway patterns and allowlist discipline should be mirrored in AI tool mapping.
- Tool schemas should use strict validation (e.g., Zod) to constrain tool inputs.
- Keep response streaming duration and route behavior compatible with App Router route handlers.
- Ensure tests cover role/tenant permutations, including privileged and non-privileged behavior.

---

## 8. Success Metrics

### Security + Correctness (selected)

- **SM-1 (Auth enforcement):** 100% of unauthenticated chat requests are rejected before model/tool execution.
- **SM-2 (Tenant correctness):** In role-based test matrix, assistant data retrieval never crosses unauthorized tenant boundaries.
- **SM-3 (Read-only guarantee):** 0 assistant-initiated create/update/delete actions in v1 execution logs/tests.
- **SM-4 (Draft validity):** >= 95% of generated repair drafts conform to schema without manual structural correction.
- **SM-5 (Failure safety):** 100% of known error paths return user-safe, non-sensitive error payloads.

---

## 9. Open Questions

- Should global panel retain conversation state across route changes in v1, or reset per session/page context?
- Which minimum read-only RPC function set should be approved for v1 tool allowlist?
- Should draft output schema be minimal (core required fields only) or include optional metadata fields initially?
- Should responses include explicit confidence/disclaimer tags for inferred recommendations?

---

## Notes for Implementation Planning

This document is **PRD-only** and intentionally does not prescribe final code structure beyond required constraints. Implementation should proceed via a separate execution plan after stakeholder approval.
