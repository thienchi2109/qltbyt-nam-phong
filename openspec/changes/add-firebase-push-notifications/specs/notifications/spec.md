## ADDED Requirements

### Requirement: Push Notification Registration
The system SHALL allow authenticated users to register their devices for push notifications.

#### Scenario: User grants permission
- **WHEN** an authenticated user grants notification permission in the browser
- **THEN** the system generates a unique FCM token
- **AND** stores the token in the `user_fcm_tokens` table associated with the user ID
- **AND** updates the `updated_at` timestamp if the token already exists

#### Scenario: User denies permission
- **WHEN** an authenticated user denies notification permission
- **THEN** the system does NOT generate a token
- **AND** no data is sent to the server

### Requirement: Send Push Notification (MVP)
The system SHALL be able to send push notifications specifically for high-priority repair requests.

#### Scenario: New Repair Request
- **WHEN** a new repair request is created
- **THEN** the system retrieves all active FCM tokens for the assigned technician and management
- **AND** sends a push notification with title "Yêu cầu sửa chữa mới" and the equipment name
- **AND** clicking the notification opens the specific repair request details page

#### Scenario: Stale tokens
- **WHEN** the system attempts to send a notification to an invalid/expired token
- **THEN** the Firebase service returns an error (e.g., UNREGISTERED)
- **AND** the system SHOULD remove the invalid token from the database (cleanup)

### Requirement: Background Notification Handling
The system SHALL handle notifications when the application is in the background or closed.

#### Scenario: App in background
- **WHEN** a notification arrives while the app is in the background
- **THEN** the Service Worker intercepts the message
- **AND** displays a system notification with the configured icon and badge
- **AND** clicking the notification opens the application to the specific URL provided in the payload
