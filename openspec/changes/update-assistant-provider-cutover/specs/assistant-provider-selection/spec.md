## ADDED Requirements

### Requirement: Configurable Assistant Chat Provider
The system SHALL select the assistant chat provider from deployment configuration, supporting Google and Groq while using exactly one active provider per deployment.

#### Scenario: Google is selected
- **WHEN** `AI_PROVIDER` is set to `google`
- **THEN** the assistant SHALL create chat models from the Google provider configuration
- **AND** it SHALL read model and API-key settings from Google-specific environment variables

#### Scenario: Groq is selected
- **WHEN** `AI_PROVIDER` is set to `groq`
- **THEN** the assistant SHALL create chat models from the Groq provider configuration
- **AND** it SHALL read model and API-key settings from Groq-specific environment variables

#### Scenario: Unsupported provider is configured
- **WHEN** `AI_PROVIDER` is set to an unsupported value
- **THEN** the server SHALL reject assistant chat initialization with an explicit provider configuration error

### Requirement: Provider-Specific Option Isolation
The system SHALL apply provider-specific SDK options only to the active provider while preserving shared assistant behavior such as streaming, tool execution, request limits, and usage metering.

#### Scenario: Groq is active
- **WHEN** the assistant handles a chat request with `AI_PROVIDER=groq`
- **THEN** the route SHALL NOT send Google-only provider options with the request
- **AND** the assistant SHALL continue to use the existing shared chat flow for tools, limits, and streaming

#### Scenario: Google is active
- **WHEN** the assistant handles a chat request with `AI_PROVIDER=google`
- **THEN** the route MAY apply Google-specific provider options
- **AND** the assistant SHALL preserve the existing Google chat behavior

### Requirement: Active-Provider-Scoped Key Rotation
The system SHALL keep API-key pooling and quota retry behavior scoped to the active provider only.

#### Scenario: Groq quota error rotates within Groq keys
- **WHEN** the active Groq key hits a provider quota or rate-limit error
- **THEN** the assistant SHALL only rotate to another Groq key if one is available
- **AND** it SHALL NOT switch to Google within the same request

#### Scenario: Google quota error rotates within Google keys
- **WHEN** the active Google key hits a provider quota or rate-limit error
- **THEN** the assistant SHALL only rotate to another Google key if one is available
- **AND** it SHALL NOT switch to Groq within the same request

### Requirement: Safe Provider Cutover and Rollback
The system SHALL support production cutover between Google and Groq through deployment configuration and redeploys, without requiring code edits for each switch.

#### Scenario: Operator cuts over to Groq
- **WHEN** operators update production environment variables to use Groq and redeploy
- **THEN** the assistant SHALL serve chat requests through Groq on the new deployment
- **AND** server diagnostics SHALL identify the active provider and model during cutover validation

#### Scenario: Operator rolls back to Google
- **WHEN** operators restore Google environment variables and redeploy
- **THEN** the assistant SHALL resume serving chat requests through Google
- **AND** the rollback SHALL NOT require source-code changes
