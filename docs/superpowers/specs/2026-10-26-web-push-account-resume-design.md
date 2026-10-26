# Restore Web Push after returning to an account

Approved behavior: receive only for the current authenticated account; remember each account's opt-in on this PWA and restore it when that account returns. The user explicitly selected this behavior on 2026-10-26.

Account switches must still locally unsubscribe the previous owner's endpoint before a new registration. Preserve opt-in intent separately from pending revoke state, so account isolation does not become an opt-out. Explicit disable/cancel and forced password-change cleanup must not accidentally authorize automatic registration. Legacy ambiguous `revoking` records must not silently acquire consent.

When an opted-in owner authenticates again, finish that owner's deferred cleanup using that owner's session, then reuse the existing registration path when permission is already granted. Never request browser permission in an effect, register a different owner's subscription, or reuse another owner's server credentials. Abort work on auth/owner changes; do not leave an endpoint created by stale work receiving notifications. Deduplicate concurrent restore/UI registration and keep retries bounded. Keep restore intent on transient network/Safari failures so the notifications page offers an explicit reconnect action without another permission prompt if permission is still granted.

No database schema, worker, infrastructure, dependencies, live writes, or deployment changes are planned. Reuse browser lifecycle/registration validation and pending states. Extract only cohesive code needed to stay below the 450-line source ceiling.

Acceptance checks: A → expired session → A remains enabled; A → B → A restores A while never receiving as A under B; explicit disable remains off across switches/reloads; accounts that never opted in remain off; permission default/denied never triggers an automatic prompt; offline/failed restore retains intent and a usable manual retry; rapid owner changes cancel stale restoration; retained revision/owner checks and registration deduplication remain intact. iPhone Safari real-device UAT is required separately before claiming platform success.
