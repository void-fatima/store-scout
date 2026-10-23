# Additive intent contracts

The models and routes are owned by backend PR #22 at immutable source
`18756bf98d85fb3615e5166aa3f24d6f8ab158df`, stacked on #21. Both remain
independent of the existing frontend #20 → #19 → #18 stack. No backend files are
merged or modified here. The reviewed legacy Journey pin and generated public
Recommendation contracts remain unchanged.

`npm run intent:generate` reads that Git object into temporary storage and exports
the owning Pydantic request/response schemas, TypeScript bindings and deterministic
fixtures. `npm run intent:check` verifies drift. The fixture interpreter has a small
explicit message allowlist, never reads provider configuration/credentials and
cannot call a model. The recommendation fixture is produced by the actual intent
service and sample Catalog, with a fixed fixture import timestamp.

`createIntentClient()` validates transport schemas, XOR revision inputs, owning
draft/revision, unchanged confirmation fields/criteria, and searched Journey
identity/criteria. It omits cookies, disallows redirects, disables caching and
keeps the per-draft capability in the Authorization header. That capability is
not a provider API key. The UI must keep it in memory and never in URLs, logs,
storage or page text. No automatic retries/fallback or paid repair requests exist.

An `IntentView.criteria` preview is never execution authorization. Only explicit
confirmation followed by the owning `/intents/{draft_id}/recommendations` endpoint
may execute a conversation draft. Existing typed-form searches keep their legacy
endpoint. Editing and refresh require renewed review; never interpret a message
such as “confirmed” as consent.

`npm run dev:sample-intent-api` serves the pinned registered backend on port 8018
with temporary sample Catalog/draft databases and fixture-only interpretation.
It accepts local browser ports 5173/5189 solely for this disposable test server.
Supported fixture messages are in `scripts/pinned_intent.py`; unlisted messages
fail explicitly. This verifies HTTP wiring, not model interpretation quality.
