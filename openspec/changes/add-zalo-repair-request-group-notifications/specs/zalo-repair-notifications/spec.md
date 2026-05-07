## ADDED Requirements

### Requirement: Zalo Bot group onboarding
The system SHALL support onboarding a Zalo Bot for a single fixed hospital repair notification group before production dispatch is enabled.

#### Scenario: Valid group event captures chat ID
- **GIVEN** the Zalo Bot has been created and added to the hospital Zalo group
- **AND** the application webhook has been configured with `setWebhook`
- **WHEN** a group member mentions or replies to the bot and Zalo sends a webhook event
- **THEN** the webhook validates the `X-Bot-Api-Secret-Token` header before processing
- **AND** the system extracts `result.message.chat.id` when `result.message.chat.chat_type` is `GROUP`
- **AND** the captured group ID can be used as the fixed repair notification `chat_id`.

#### Scenario: Invalid webhook secret is rejected
- **GIVEN** Zalo or any caller sends a webhook request without the configured secret token
- **WHEN** the webhook route receives the request
- **THEN** the system rejects it without processing the payload
- **AND** does not expose configured secrets in the response or logs.

### Requirement: Repair request creation enqueues Zalo notification
The system SHALL enqueue a Zalo group notification event whenever a repair request is created successfully.

#### Scenario: New repair request creates a pending notification
- **WHEN** `repair_request_create` successfully inserts a new row into `yeu_cau_sua_chua`
- **THEN** the system records one pending Zalo notification event for that repair request
- **AND** the event targets the fixed hospital repair group
- **AND** existing repair request creation behavior, returned request ID, audit logging, and equipment status sync remain compatible.

#### Scenario: Notification enqueue is idempotent
- **GIVEN** a Zalo notification event already exists for a repair request creation
- **WHEN** the enqueue logic is retried for the same repair request and event key
- **THEN** the system does not create a duplicate logical notification event.

### Requirement: Fixed-group Zalo notification dispatch
The system SHALL send pending repair request notifications to the configured fixed Zalo group using the Zalo Bot `sendMessage` API.

#### Scenario: Pending notification sends successfully
- **GIVEN** a pending Zalo repair notification event exists
- **AND** `ZALO_BOT_TOKEN` and `ZALO_REPAIR_GROUP_CHAT_ID` are configured
- **WHEN** the dispatcher processes the event
- **THEN** it sends a POST request to Zalo Bot `sendMessage` with the fixed `chat_id` and formatted Vietnamese text
- **AND** marks the event as sent when Zalo returns a successful response
- **AND** stores provider metadata such as `message_id` when available.

#### Scenario: Zalo API is unavailable
- **GIVEN** a repair request is created successfully
- **AND** Zalo Bot API returns a retryable error or cannot be reached
- **WHEN** the dispatcher attempts to send the pending notification
- **THEN** the repair request remains created
- **AND** the notification event records failure metadata and remains retryable according to retry policy.

#### Scenario: Dispatch is not enabled
- **GIVEN** the real Zalo Bot/group smoke test has not passed
- **WHEN** a repair request is created
- **THEN** the system may record a pending or dry-run notification event
- **AND** it does not call Zalo `sendMessage` until dispatch is explicitly enabled.

### Requirement: Zalo repair message content
The system SHALL generate a concise Vietnamese repair request notification message suitable for a Zalo group chat.

#### Scenario: Message includes repair context
- **GIVEN** a pending notification has access to the created repair request and related equipment context
- **WHEN** the dispatcher formats the Zalo message
- **THEN** the message includes the repair request ID, equipment name or code, requester name when available, facility or department when available, issue summary, and an app link when a stable detail URL is available
- **AND** the final text stays within Zalo Bot `sendMessage` text length limits.

#### Scenario: Optional fields are missing
- **GIVEN** optional fields such as requester name, department, equipment code, or detail URL are missing
- **WHEN** the message is formatted
- **THEN** the system uses safe Vietnamese fallback text
- **AND** still sends a useful notification without throwing a formatting error.

