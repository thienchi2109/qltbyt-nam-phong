## ADDED Requirements

### Requirement: Canonical expert role and account ownership

The system SHALL represent the expert role with the canonical stored and
session value `chuyen_gia`, display it as `Chuyên gia`, and SHALL NOT normalize
it to `global`. Only `global/admin` users SHALL be able to create, assign,
update, deactivate, or delete accounts with this role. A `chuyen_gia` account
SHALL have an assigned current/home `don_vi`, membership in that unit, and an
authoritatively resolvable `dia_ban_id`. These account-scope fields SHALL NOT
tenant-scope Technical Configurations data, and the role SHALL NOT have tenant
switching capability. Every account-management, membership, or current-unit
mutation SHALL preserve this complete invariant atomically or reject without
changing account state. Successful scope replacement SHALL use the dedicated
`user_reassign_expert_scope(p_user_id, p_don_vi)` database operation rather
than a client-orchestrated sequence of generic membership RPCs.

#### Scenario: Global administrator creates an expert account

- **GIVEN** an authenticated `global/admin` user
- **WHEN** the administrator creates a `chuyen_gia` account with an assigned
  current/home `don_vi`, its membership, and a resolvable `dia_ban_id`
- **THEN** the account is stored with role `chuyen_gia`
- **AND** the account can authenticate without being offered tenant switching

#### Scenario: Expert attempts to switch tenant

- **GIVEN** an authenticated `chuyen_gia` account with assigned `don_vi` and
  resolvable `dia_ban_id`
- **WHEN** the user calls tenant-membership or tenant-switch functionality
- **THEN** the server denies the operation
- **AND** the session's assigned tenant does not change

#### Scenario: Administrator removes an expert membership

- **GIVEN** a `chuyen_gia` account whose current/home `don_vi`, membership, and
  `dia_ban_id` satisfy the required invariant
- **WHEN** a `global/admin` caller uses `user_membership_remove`,
  `user_set_current_don_vi`, or a related management path without supplying an
  atomic valid replacement
- **THEN** the operation is rejected
- **AND** the expert's account, current/home unit, membership, and region
  metadata remain unchanged

#### Scenario: Administrator uses a generic RPC for an otherwise valid switch

- **GIVEN** a `chuyen_gia` account already has membership in a valid destination
  unit
- **WHEN** a `global/admin` caller uses `user_set_current_don_vi`,
  `user_membership_add`, `user_membership_remove`, or another generic path to
  change the expert's scope
- **THEN** the operation is rejected even if the resulting invariant could
  remain valid
- **AND** successful expert scope replacement remains exclusive to
  `user_reassign_expert_scope`

#### Scenario: Administrator atomically reassigns an expert

- **GIVEN** a `global/admin` caller and a valid replacement `don_vi` whose
  membership and `dia_ban_id` can be established
- **WHEN** the caller invokes
  `user_reassign_expert_scope(p_user_id, p_don_vi)`
- **THEN** the current/home unit, matching membership, and resolvable region are
  changed atomically
- **AND** the account never persists an intermediate state that violates the
  expert invariant

#### Scenario: Expert cannot manage users or roles

- **GIVEN** an authenticated `chuyen_gia` user
- **WHEN** the user requests Users, Tenants, or a user-management action
- **THEN** the system denies the route and server-side action
- **AND** no account or role state changes

#### Scenario: Expert role is not a global alias

- **WHEN** the system evaluates `chuyen_gia` through global-role predicates or
  signs an application JWT
- **THEN** `chuyen_gia` remains distinct from `global/admin`
- **AND** no unrelated global/admin capability is granted

#### Scenario: Expert is evaluated by existing role helpers

- **WHEN** the system evaluates `chuyen_gia` through existing regional,
  equipment-management, Device Quota, department-scoped, or tenant-selection
  predicates
- **THEN** every unrelated predicate returns false
- **AND** only the exact expert predicate and Technical Configurations
  capability return true

### Requirement: Expert landing and application route isolation

The system SHALL use `/technical-configurations` as the default authenticated
route for `chuyen_gia`. The role SHALL be allowed to enter the Technical
Configurations route family and the shared access-denied route only; every
other mapped application route, including Dashboard, SHALL be denied.

#### Scenario: Expert completes login

- **GIVEN** valid credentials for a `chuyen_gia` account
- **WHEN** authentication succeeds
- **THEN** the user is sent to `/technical-configurations`
- **AND** Dashboard is never rendered as an intermediate destination

#### Scenario: Authenticated expert visits the root route

- **GIVEN** an authenticated `chuyen_gia` user
- **WHEN** the user visits `/`
- **THEN** the server redirects to `/technical-configurations`

#### Scenario: Expert requests another mapped app route

- **GIVEN** an authenticated `chuyen_gia` user
- **WHEN** the user requests `/dashboard` or any other mapped non-Technical-
  Configurations app route
- **THEN** middleware redirects to `/access-denied`
- **AND** the rejected URL is not exposed in the redirect target

#### Scenario: Existing roles retain their route behavior

- **WHEN** a user with any existing non-`chuyen_gia` role requests an app route
- **THEN** the route policy behaves exactly as before this change
- **AND** `global/admin` retains access to Technical Configurations

### Requirement: Expert app-shell isolation

The authenticated app shell SHALL expose only Technical Configurations
navigation and account/session controls to `chuyen_gia`. It SHALL hide and
disable data fetching for tenant selection, equipment search, operational
notifications, AI Assistant, onboarding/help, and mobile feature actions. It
SHALL keep assigned-unit application branding through the explicitly classified
`don_vi_branding_get` retained-shell RPC.

#### Scenario: Expert sees the permitted shell

- **GIVEN** an authenticated `chuyen_gia` user on
  `/technical-configurations`
- **WHEN** the app shell renders
- **THEN** navigation contains only the Technical Configurations destination
- **AND** application identity, role/account display, change-password, and
  sign-out controls remain available
- **AND** branding is loaded only for the expert's assigned `don_vi`

#### Scenario: Hidden shell features do not fetch data

- **GIVEN** an authenticated `chuyen_gia` user
- **WHEN** the app shell initializes
- **THEN** tenant, equipment-search, operational-notification, assistant,
  onboarding, and mobile-feature queries or bootstraps are disabled
- **AND** their controls are not rendered

### Requirement: Module-scoped Technical Configurations capability

The system SHALL grant `chuyen_gia` the same system-wide read/write capability
as `global/admin` for all operations owned by Technical Configurations,
including baseline, criteria, reference products, suppliers, assessments,
comparisons, import/export, copy, lock, and publish operations. Every such
operation SHALL reach one explicit module authorization boundary directly or
through a verified module-helper call chain. The shared application RPC proxy
SHALL use an independent exact expert allowlist containing only audited
Technical Configurations RPCs and explicitly documented account/session
infrastructure required by the retained shell. This infrastructure SHALL
include `don_vi_branding_get` and `change_password`. Every current generic
`ALLOWED_FUNCTIONS` entry SHALL have an explicit expert allow/deny
classification, and unrelated feature APIs and RPCs SHALL remain denied.

#### Scenario: Expert performs a Technical Configurations operation

- **GIVEN** a valid authenticated `chuyen_gia` session
- **WHEN** the user invokes any current Technical Configurations read or
  mutation through the application RPC boundary
- **THEN** authorization succeeds system-wide without filtering by the
  account's assigned `don_vi` or `dia_ban_id`
- **AND** the proxy does not rewrite caller-supplied `p_don_vi`, `p_dia_ban`,
  or equivalent module parameters through its generic tenant-scoping helper
- **AND** the operation retains its existing validation, concurrency, audit,
  and data-integrity behavior

#### Scenario: Expert invokes an unrelated server operation

- **GIVEN** a valid authenticated `chuyen_gia` session
- **WHEN** the user invokes a standalone feature API or RPC not owned by
  Technical Configurations, including Chat, tenant switching, a Device Quota
  asynchronous suggestion job, or the synchronous suggestion provider
- **THEN** the existing authorization boundary denies the operation
- **AND** the role is not treated as `global/admin`

#### Scenario: Expert invokes a generically allowlisted non-module RPC

- **GIVEN** a valid authenticated `chuyen_gia` session
- **AND** an unrelated tenant-scoped RPC such as
  `dinh_muc_quyet_dinh_list` is present in the generic `ALLOWED_FUNCTIONS`
  transport set
- **WHEN** the expert invokes that RPC through the application proxy
- **THEN** the proxy returns `403` before tenant-body rewriting, JWT minting,
  or upstream fetch
- **AND** the account's assigned `don_vi` does not grant access

#### Scenario: Expert uses retained shell and account infrastructure

- **GIVEN** a valid authenticated `chuyen_gia` session
- **WHEN** the user invokes an explicitly classified self-service operation
  required by the retained shell, such as `change_password`, or loads assigned
  branding through `don_vi_branding_get`
- **THEN** the proxy permits the request under the operation's existing
  authorization contract
- **AND** branding remains scoped to the assigned `don_vi`
- **AND** no unrelated feature capability is granted

#### Scenario: Existing global aliases retain proxy access

- **GIVEN** either a `global` session or a session containing the raw legacy
  `admin` role
- **WHEN** the user invokes a representative non-module RPC allowed by the
  existing proxy and underlying authorization contract
- **THEN** the new expert-only proxy branch does not reject the request
- **AND** existing `admin -> global` JWT normalization remains unchanged

#### Scenario: Expert has no department claim

- **GIVEN** a valid `chuyen_gia` session with required `don_vi` and
  `dia_ban_id` claims but null or empty `khoa_phong`
- **WHEN** the user invokes a Technical Configurations operation through the
  application RPC proxy
- **THEN** the proxy accepts the expert session and signs a null department
  claim for the downstream RPC
- **AND** a genuinely null/absent department remains rejected for every
  non-expert role
- **AND** the pre-existing non-expert empty-string parsing and JWT normalization
  behavior remains unchanged

#### Scenario: Existing non-expert role invokes Technical Configurations

- **GIVEN** an authenticated role other than `global`, `admin`, or
  `chuyen_gia`
- **WHEN** the user requests a Technical Configurations route or RPC
- **THEN** the system denies access fail-closed

#### Scenario: A new module RPC is introduced

- **WHEN** implementation adds a new proxy-exposed RPC owned by Technical
  Configurations
- **THEN** the operation explicitly reaches the canonical module authorization
  helper directly or through a reviewed module-helper call chain
- **AND** the RPC proxy classification explicitly adds the operation to the
  expert allow set
- **AND** focused authorization coverage proves that `global/admin/chuyen_gia`
  are allowed and all other application roles are denied

#### Scenario: A new standalone module operation is introduced

- **WHEN** implementation adds a standalone server route or operation owned by
  Technical Configurations
- **THEN** its server boundary uses the exact Technical Configurations module
  capability
- **AND** direct-request coverage proves `global/admin/chuyen_gia` are allowed
  and every unrelated application role is denied
- **AND** the standalone operation is not registered as an RPC merely to satisfy
  proxy classification

#### Scenario: A new generic proxy RPC is introduced

- **WHEN** implementation adds an entry to `ALLOWED_FUNCTIONS`
- **THEN** the exhaustive classification test fails until the entry declares an
  explicit expert allow or deny disposition
- **AND** an unclassified entry is never available to `chuyen_gia` by default

### Requirement: Authoritative role refresh for active sessions

The system SHALL refresh the current database role into the NextAuth JWT and
session no later than the first active profile refresh after the existing
60-second interval. A due refresh that cannot authoritatively confirm a valid
role SHALL fail closed instead of continuing to mint application RPC JWTs from
a stale role. An authoritative `chuyen_gia` profile MAY contain a null
`khoa_phong`; this SHALL NOT invalidate an otherwise complete expert session.
For `chuyen_gia`, refreshed scope claims SHALL replace stale token values, and
missing `don_vi` or unresolved `dia_ban_id` SHALL invalidate the session rather
than fall back to prior claims.

#### Scenario: Global user is changed to expert

- **GIVEN** an authenticated session whose token contains `global`
- **WHEN** an administrator changes the database role to `chuyen_gia`
- **THEN** the next due profile refresh updates the JWT/session role within 60
  seconds of active use
- **AND** refreshed `don_vi` and `dia_ban_id` replace stale token values
- **AND** an authoritative null `khoa_phong` clears any stale department claim
- **AND** subsequent Dashboard or unrelated RPC access is denied
- **AND** Technical Configurations access remains available

#### Scenario: Expert is changed to another role

- **GIVEN** an authenticated session whose token contains `chuyen_gia`
- **WHEN** an administrator changes the database role
- **THEN** the next due profile refresh applies the new role
- **AND** route, navigation, shell, and RPC authorization use the refreshed
  role

#### Scenario: Due role refresh cannot confirm authorization

- **GIVEN** a session whose authorization profile refresh is due
- **WHEN** the profile RPC fails, returns no user, or returns an empty or
  unsupported role
- **THEN** the application invalidates or signs out the session fail-closed
- **AND** it does not sign a Supabase RPC JWT using the stale role

#### Scenario: Refreshed expert scope is incomplete

- **GIVEN** a due refresh whose database role is `chuyen_gia`
- **WHEN** the authoritative profile has no assigned `don_vi` or no resolvable
  `dia_ban_id`
- **THEN** the application invalidates or signs out the session fail-closed
- **AND** stale token scope is not reused
