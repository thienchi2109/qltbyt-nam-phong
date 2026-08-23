## ADDED Requirements

### Requirement: Canonical expert role and account ownership

The system SHALL represent the expert role with the canonical stored and
session value `chuyen_gia`, display it as `Chuyên gia`, and SHALL NOT normalize
it to `global`. Only `global/admin` users SHALL be able to create, assign,
update, deactivate, or delete accounts with this role. A `chuyen_gia` account
SHALL NOT require `don_vi`, tenant membership, or tenant switching.

#### Scenario: Global administrator creates an expert account

- **GIVEN** an authenticated `global/admin` user
- **WHEN** the administrator creates a `chuyen_gia` account without `don_vi` or
  tenant memberships
- **THEN** the account is stored with role `chuyen_gia`
- **AND** the account can authenticate without selecting a tenant

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
notifications, AI Assistant, onboarding/help, and mobile feature actions.

#### Scenario: Expert sees the permitted shell

- **GIVEN** an authenticated `chuyen_gia` user on
  `/technical-configurations`
- **WHEN** the app shell renders
- **THEN** navigation contains only the Technical Configurations destination
- **AND** application identity, role/account display, change-password, and
  sign-out controls remain available

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
operation SHALL enforce one explicit module authorization boundary, while
unrelated APIs and RPCs remain denied.

#### Scenario: Expert performs a Technical Configurations operation

- **GIVEN** a valid authenticated `chuyen_gia` session
- **WHEN** the user invokes any current Technical Configurations read or
  mutation through the application RPC boundary
- **THEN** authorization succeeds without requiring `don_vi`
- **AND** the operation retains its existing validation, concurrency, audit,
  and data-integrity behavior

#### Scenario: Expert invokes an unrelated server operation

- **GIVEN** a valid authenticated `chuyen_gia` session
- **WHEN** the user invokes an API or RPC not owned by Technical Configurations
- **THEN** the existing authorization boundary denies the operation
- **AND** the role is not treated as `global/admin`

#### Scenario: Existing non-expert role invokes Technical Configurations

- **GIVEN** an authenticated role other than `global`, `admin`, or
  `chuyen_gia`
- **WHEN** the user requests a Technical Configurations route or RPC
- **THEN** the system denies access fail-closed

#### Scenario: A new module operation is introduced

- **WHEN** implementation adds a new RPC or server operation owned by Technical
  Configurations
- **THEN** the operation explicitly uses the canonical module authorization
  helper
- **AND** focused authorization coverage proves that `global/admin/chuyen_gia`
  are allowed and all other application roles are denied

### Requirement: Authoritative role refresh for active sessions

The system SHALL refresh the current database role into the NextAuth JWT and
session no later than the first active profile refresh after the existing
60-second interval. A due refresh that cannot authoritatively confirm a valid
role SHALL fail closed instead of continuing to mint application RPC JWTs from
a stale role.

#### Scenario: Global user is changed to expert

- **GIVEN** an authenticated session whose token contains `global`
- **WHEN** an administrator changes the database role to `chuyen_gia`
- **THEN** the next due profile refresh updates the JWT/session role within 60
  seconds of active use
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
