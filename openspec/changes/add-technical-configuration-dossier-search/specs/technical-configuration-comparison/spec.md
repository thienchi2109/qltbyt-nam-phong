## ADDED Requirements

### Requirement: Server-side normalized dossier search

The system SHALL allow an authorized user to search the technical-configuration dossier list across all server pages by dossier name and device type while preserving the existing archive and authorization boundaries.

#### Scenario: Empty search preserves the default list

- **WHEN** the dossier list request omits `p_search`, passes `NULL`, or passes text that normalizes to empty
- **THEN** the system returns the same active dossier set, total, pagination payload, `can_delete` values, and `updated_at DESC, id` ordering as before this change

#### Scenario: Vietnamese accent-insensitive matching

- **GIVEN** a dossier has a name or device type containing `Máy siêu âm`
- **WHEN** the user searches for `may sieu am`
- **THEN** the dossier is included regardless of case, Vietnamese diacritics, or composed/decomposed Unicode representation

#### Scenario: Punctuation and separators normalize to spaces

- **GIVEN** a searchable field contains `X-quang` or `CT/MRI`
- **WHEN** the user searches for the equivalent space-separated tokens
- **THEN** the dossier is included after punctuation replacement and whitespace collapsing

#### Scenario: Every token must match across the identity fields

- **GIVEN** one normalized token appears in `device_type_name` and another appears in `name`
- **WHEN** the user submits both tokens in any order
- **THEN** the dossier is included
- **AND** a dossier missing any token is excluded

#### Scenario: Description and UUID do not participate

- **GIVEN** a token exists only in the dossier description or UUID
- **WHEN** the user searches for that token
- **THEN** the dossier is not included

#### Scenario: Wildcard characters are literal

- **WHEN** the user includes `%`, `_`, or `\` in the raw search value
- **THEN** caller input cannot expand the SQL match pattern
- **AND** punctuation-only input behaves as an empty search

#### Scenario: Search length is bounded

- **WHEN** the raw `p_search` value exceeds 200 characters
- **THEN** the RPC rejects the request through its validation error contract
- **AND** any non-empty normalized value of 200 characters or fewer, including one character, is accepted

### Requirement: Search ranking, totals, and pagination

The system SHALL calculate search relevance, filtered totals, and pagination on the server with one deterministic predicate contract.

#### Scenario: Exact and prefix matches rank first

- **GIVEN** multiple dossiers satisfy every normalized token
- **WHEN** one dossier exactly matches the full normalized query in its name or device type
- **THEN** it ranks before prefix-only and token-substring matches
- **AND** exact or prefix matches in either searchable field use the same relevance tier

#### Scenario: Token matches use stable tie-breakers

- **WHEN** multiple dossiers have the same relevance tier
- **THEN** they are ordered by `updated_at DESC, id`

#### Scenario: Filtered total drives page count

- **WHEN** a search matches dossiers across multiple server pages
- **THEN** `total` counts only dossiers satisfying the same archive and search predicate
- **AND** page data is sliced from that filtered, ranked set
- **AND** clearing search restores the unfiltered total and page count

#### Scenario: Delete eligibility remains page-scoped and set-wise

- **WHEN** a filtered page is returned
- **THEN** each row's `can_delete` value is derived with the existing locked-baseline contract
- **AND** search does not introduce per-row RPC calls

### Requirement: Dossier search interaction states

The dossier list UI SHALL compose existing shared search and pagination primitives while distinguishing initial loading, pending search, no results, and errors.

#### Scenario: Search is local and debounced

- **WHEN** the user changes the raw search input
- **THEN** pagination resets to page 1 immediately
- **AND** no new list request is sent until the normalized value remains stable for 300 ms
- **AND** the search value is not written to the URL

#### Scenario: Equivalent normalized queries share cache identity

- **WHEN** two raw values normalize to the same dossier search value
- **THEN** the list query uses the same normalized search identity
- **AND** different normalized values or pages use isolated list keys

#### Scenario: Pending search preserves rows

- **GIVEN** the list has rendered rows
- **WHEN** debounce or a search request is pending
- **THEN** the previous rows remain visible
- **AND** the shared search input displays a loading addon
- **AND** the table region reports `aria-busy`
- **AND** pagination navigation is disabled
- **AND** typing and clearing remain enabled

#### Scenario: Initial load uses skeleton rows

- **WHEN** the dossier list has no prior data and its first request is pending
- **THEN** the existing skeleton state is displayed

#### Scenario: Empty states are distinct

- **WHEN** the unfiltered active dossier list is empty
- **THEN** the UI displays `Chưa có hồ sơ cấu hình`
- **WHEN** an active search returns no dossiers
- **THEN** the UI displays `Không tìm thấy hồ sơ phù hợp với "<raw search>"`

#### Scenario: Search request fails

- **WHEN** the current search request fails
- **THEN** the search toolbar remains visible with its raw value
- **AND** the UI displays the existing retry alert
- **AND** stale rows are not presented as the current search result

#### Scenario: Shared input clear behavior is preserved

- **WHEN** the user activates the clear button or presses Escape with a non-empty value
- **THEN** the raw search is cleared
- **AND** focus returns to the input through the shared `SearchInput` behavior
- **AND** the default list is requested after the 300 ms debounce contract
