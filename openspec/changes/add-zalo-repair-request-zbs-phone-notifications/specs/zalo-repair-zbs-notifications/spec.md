## ADDED Requirements

### Requirement: ZBS template readiness

The system SHALL keep repair-request ZBS phone notification dispatch disabled until an approved ZBS template and recipient configuration are available.

#### Scenario: Missing approved template

- **GIVEN** no approved ZBS repair-request template ID is configured
- **WHEN** a repair request is created successfully
- **THEN** the system does not call the Zalo API
- **AND** the system records or exposes configuration status so operators can complete setup.

#### Scenario: Missing recipient configuration

- **GIVEN** an approved ZBS repair-request template ID is configured
- **AND** no active ZBS repair-request recipient configuration exists for the repair request tenant
- **WHEN** a repair request is created successfully
- **THEN** the system does not call the Zalo API
- **AND** no cross-tenant recipient fallback is used.

#### Scenario: Template data shape is explicit

- **GIVEN** an approved ZBS template is configured
- **WHEN** the dispatcher prepares a notification
- **THEN** the generated `template_data` matches the configured template field names
- **AND** required fields are present before any outbound API call is attempted.

### Requirement: Repair request creation enqueues ZBS phone notification

The system SHALL enqueue a ZBS phone notification event whenever a repair request is created successfully and active ZBS phone notification recipients are configured for the same tenant as the created repair request.

#### Scenario: New repair request creates pending phone notifications

- **WHEN** `repair_request_create` successfully inserts a new row into `yeu_cau_sua_chua`
- **THEN** the system derives notification scope from the created repair request's `don_vi_id`
- **AND** records one pending ZBS notification event for each active recipient phone number configured for that same `don_vi_id` and `event_type`
- **AND** each event includes `event_type`, `source_type`, `source_id`, `don_vi_id`, recipient configuration ID, normalized recipient phone, template ID, template-data snapshot, and tracking ID
- **AND** existing repair request creation behavior, returned request ID, audit logging, and equipment status sync remain compatible.

#### Scenario: Multiple same-tenant recipients are supported

- **GIVEN** tenant A has two active ZBS repair-request recipients
- **WHEN** a repair request is created for tenant A
- **THEN** the system enqueues two pending ZBS notification events
- **AND** each event references a different recipient configuration
- **AND** each event can be sent, retried, or failed independently.

#### Scenario: Recipient phones are stored one per row

- **WHEN** recipient configuration is stored
- **THEN** each phone number is represented by one recipient configuration row
- **AND** the system does not store multiple recipient phone numbers in a comma-separated field.

#### Scenario: Notification enqueue is idempotent

- **GIVEN** a ZBS notification event already exists for an event type, source record, and tenant-scoped recipient configuration
- **WHEN** enqueue logic is retried for the same repair request and recipient
- **THEN** the system does not create a duplicate logical notification event.

### Requirement: Tenant-scoped ZBS recipient isolation

The system SHALL route repair-request ZBS notifications only to active recipients configured for the same tenant (`don_vi_id`) as the created repair request.

#### Scenario: Tenant A request notifies only tenant A recipients

- **GIVEN** tenant A has an active ZBS repair-request recipient
- **AND** tenant B has an active ZBS repair-request recipient
- **WHEN** a repair request is created for tenant A
- **THEN** the system enqueues notification events only for tenant A recipients
- **AND** no event is enqueued for tenant B recipients.

#### Scenario: Tenant B request notifies only tenant B recipients

- **GIVEN** tenant A has an active ZBS repair-request recipient
- **AND** tenant B has an active ZBS repair-request recipient
- **WHEN** a repair request is created for tenant B
- **THEN** the system enqueues notification events only for tenant B recipients
- **AND** no event is enqueued for tenant A recipients.

#### Scenario: Tenant has no active recipient

- **GIVEN** a repair request is created for tenant A
- **AND** tenant A has no active ZBS repair-request recipient
- **WHEN** enqueue logic runs
- **THEN** no ZBS notification event is enqueued
- **AND** the system does not fall back to another tenant or global recipient.

#### Scenario: Inactive recipient is ignored

- **GIVEN** tenant A has an inactive ZBS repair-request recipient
- **WHEN** a repair request is created for tenant A
- **THEN** no notification event is enqueued for the inactive recipient.

### Requirement: Generic ZBS notification event model

The system SHALL model ZBS notification outbox rows by event type and source record so future event types can reuse the same delivery infrastructure.

#### Scenario: Repair request uses generic event identity

- **WHEN** a repair request creation notification is enqueued
- **THEN** the outbox row records `event_type` as `repair_request_created`
- **AND** records `source_type` as `repair_request`
- **AND** records `source_id` as the created repair request ID.

#### Scenario: Transfer notification is not implemented yet

- **GIVEN** a transfer request is created
- **WHEN** this change is implemented
- **THEN** no `transfer_request_created` ZBS notification is enqueued
- **AND** adding that event later does not require replacing the outbox identity model.

### Requirement: ZBS phone notification dispatch

The system SHALL send pending repair-request notifications using the official ZBS phone Template Message API.

#### Scenario: Pending notification sends successfully

- **GIVEN** a pending notification has a normalized recipient phone number, approved template ID, valid template data, and Zalo credentials
- **WHEN** the dispatcher sends the notification
- **THEN** it calls `POST https://business.openapi.zalo.me/message/template`
- **AND** it sends `access_token` in the request header
- **AND** the request body includes `phone`, `template_id`, `template_data`, and `tracking_id`
- **AND** the notification is marked sent with provider `msg_id`, provider send timestamp, and quota metadata when returned.

#### Scenario: Zalo API is unavailable

- **GIVEN** a repair request is created successfully
- **AND** Zalo returns a retryable error or cannot be reached
- **WHEN** the dispatcher attempts to send the pending notification
- **THEN** the repair request remains created
- **AND** the notification event records failure metadata and remains retryable according to retry policy.

#### Scenario: One recipient send fails while another succeeds

- **GIVEN** two pending notifications exist for the same source event and tenant
- **WHEN** the dispatcher sends both notifications
- **AND** one recipient send succeeds while the other fails
- **THEN** each outbox row records its own status and provider metadata
- **AND** the failed recipient remains retryable according to retry policy
- **AND** the successful recipient is not resent only because another recipient failed.

#### Scenario: Dispatch is not enabled

- **GIVEN** ZBS dispatch is disabled by feature gate
- **WHEN** a repair request notification is pending
- **THEN** no outbound Zalo API call is made
- **AND** the pending event remains inspectable for operators.

### Requirement: ZBS access token lifecycle

The system SHALL manage Zalo ZBS/OA access tokens server-side before any scheduled or live dispatch uses the ZBS phone Template Message API.

#### Scenario: Still-valid durable access token is reused

- **GIVEN** durable server-side token state contains an access token that is not expired and not near expiry
- **WHEN** the dispatcher prepares to send pending notifications
- **THEN** the dispatcher uses that access token
- **AND** it does not call the Zalo token refresh endpoint.

#### Scenario: Missing or near-expired access token is refreshed

- **GIVEN** durable token state has no access token, an expired access token, or an access token near expiry
- **AND** a refresh token is available from durable state or bootstrap secret material
- **WHEN** the dispatcher prepares to send pending notifications
- **THEN** the system refreshes the access token using the configured Zalo app ID, app secret, and refresh token
- **AND** it persists the returned access token, access-token expiry, refresh token, refresh-token issue/expiry metadata when available, and refresh timestamp before sending.

#### Scenario: Refresh token rotation is persisted atomically

- **GIVEN** Zalo returns a rotated refresh token during access-token refresh
- **WHEN** the system persists token refresh success
- **THEN** the new refresh token replaces the prior refresh token atomically
- **AND** concurrent stale refresh-token writes do not overwrite newer durable token state.

#### Scenario: Token refresh failure is sanitized and visible

- **GIVEN** a dispatcher batch has claimed pending outbox rows
- **AND** access-token refresh fails
- **WHEN** the dispatcher handles the failure
- **THEN** claimed outbox rows are marked failed or retryable failed with a clear sanitized token-refresh error code and message
- **AND** plaintext access tokens, refresh tokens, app secret, and provider token payloads are not logged or returned to clients.

#### Scenario: Static access token env is not source of truth

- **GIVEN** `ZALO_ZBS_ACCESS_TOKEN` is present or stale in deployment env
- **WHEN** the dispatcher runs
- **THEN** production dispatch does not depend on that env var
- **AND** token bootstrap uses approved static secret material such as app ID, app secret, and initial refresh token instead.

### Requirement: ZBS repair message content

The system SHALL generate approved-template data for a concise Vietnamese repair request notification.

#### Scenario: Template data includes repair context

- **GIVEN** a pending notification has access to the created repair request and related equipment context
- **WHEN** the dispatcher maps data for the approved ZBS template
- **THEN** template data includes the repair request ID, equipment name or code, requester name when available, facility or department when available, issue summary, and an app link when a stable detail URL is available.

#### Scenario: Optional fields are missing

- **GIVEN** optional context such as requester name, department, or equipment display name is unavailable
- **WHEN** the dispatcher maps template data
- **THEN** it uses documented fallbacks
- **AND** it does not send malformed required template data to Zalo.

### Requirement: ZBS delivery webhook processing

The system SHALL support ZBS delivery webhook processing for phone notification delivery status. Webhooks SHALL NOT be used as the trigger for creating outbound repair-request notifications.

#### Scenario: Valid delivery webhook updates notification status

- **GIVEN** Zalo sends a phone-delivery webhook event with `event_name` of `user_received_message`
- **AND** the event signature is valid
- **WHEN** the webhook route processes the event
- **THEN** it matches the notification by `tracking_id`
- **AND** it records provider `msg_id`, recipient phone metadata, provider delivery time, webhook receipt time, and delivered status.

#### Scenario: Invalid webhook signature is rejected

- **GIVEN** a caller sends a webhook request with a missing or invalid `X-ZEvent-Signature`
- **WHEN** the webhook route receives the request
- **THEN** the system rejects the request
- **AND** no notification status is updated.

### Requirement: UID sending is excluded from initial rollout

The system SHALL NOT require OA-scoped `user_id` values for the initial ZBS phone notification rollout.

#### Scenario: Phone recipient is configured but UID is absent

- **GIVEN** a valid recipient phone number is configured
- **AND** no OA-scoped `user_id` is stored for that recipient
- **WHEN** a repair request is created
- **THEN** the phone-based ZBS notification path remains valid
- **AND** no UID send attempt is made.
