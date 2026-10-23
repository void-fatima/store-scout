# Persian shopping intent — Stage 2 backend

The application now has an opt-in, model-backed interpretation API connected to
the existing Journey service. A user message becomes a **draft**, not a search.
Only an explicitly confirmed persisted revision can execute through this API.
There is no frontend chat UI and no new ranking implementation.

## Inspected architecture and reuse

The Stage 1 dependency is PR #21, commit
`26931a4d19d9978fe54a9d9c1780899bbbe40da3`. It was still unmerged when this branch
was created, so this PR stacks on `feat/journey-boxapi-client`.

Existing components reused:

- `torob.api.create_app` and its lifespan-owned `CatalogRepository`.
- `SearchCriteria`, `ShoppingRequest`, `adapt_criteria` and `run_recommendations`.
- Recommendation's exact money conversion, lexical retrieval, ranking,
  alternatives, provenance, coverage and inventory uncertainty.
- The BoxAPI HTTPS client, transport limits, TLS and sanitized errors.
- `ErrorResponse` and the existing `JourneyRecommendations` result envelope.

The missing pieces implemented here are extraction, strict local validation,
deterministic normalization, clarification, persistent drafts, version-bound
confirmation, capability protection and registered HTTP endpoints. Existing
Catalog and Recommendation modules and existing request/result contracts are
unchanged. `contracts/openapi.json` adds the new API; all preexisting paths and
schemas were compared against the Stage 1 baseline and are identical.

```text
POST message → one BoxAPI completion → local JSON/evidence validation
  → deterministic money/radius/preference normalization → persisted draft
  → explicit revisions/clarification → normalized summary
  → explicit confirmation of current revision → existing Journey service
  → actual Catalog/Recommendation result
```

## Local configuration

The account owner reported successful Stage 1 connectivity with the non-secret
model ID `gpt-6.1-sol` and parameter `max_completion_tokens`. That verifies the
previous 64-token smoke, not extraction quality or the complete workflow.
**No additional paid provider request was made for Stage 2.**

Supply the real key only through the server's environment or secret manager.
Never put it in frontend variables, requests to this API, chat, source files,
logs or command arguments. There are no production prompts.

| Environment variable | Requirement |
| --- | --- |
| `STORE_SCOUT_LLM_API_KEY` | Existing server-side credential. |
| `STORE_SCOUT_LLM_BASE_URL` | Existing default: `https://ai.boxapi.ir/ai/v1`; trusted HTTPS overrides only. |
| `STORE_SCOUT_LLM_MODEL` | Required explicitly; the account-tested ID is `gpt-6.1-sol`. |
| `STORE_SCOUT_LLM_OUTPUT_LIMIT_PARAMETER` | Required explicitly; the account-tested choice is `max_completion_tokens`. No parameter fallback. |
| `STORE_SCOUT_LLM_EXTRACTION_MAX_TOKENS` | Default 1024, allowed 512–2048. Check the chosen model's limits before live extraction. |

The 1024-token extraction cap allows a compact JSON draft beyond the 64-token
connectivity smoke. A 2048-token hard ceiling limits cost. Reasoning models may
spend part of this allowance on hidden reasoning; an incomplete response fails
safely and is never retried automatically. The larger extraction cap has not
been live-tested in this stage. The smoke retains its original 64-token cap and
default client instances retain their 256-token maximum.

[BoxAPI's public documentation](https://boxapi.ir/docs/ai) does not establish
strict JSON-schema support or universal parameter compatibility. This module
uses one ordinary system/user chat completion, without `response_format`, tools
or provider-side schema assumptions. JSON parsing and validation are local.
The account-tested parameter is still required in server configuration.

[.env.example](.env.example) contains reference placeholders and non-secret
configuration only. **Saving or copying a `.env` file does not load it.** Neither
this module nor the application loads dotenv files.

For a local interactive PowerShell session, enter the key invisibly into the
server environment without putting it in shell history. Initialize the sample
Catalog first if needed, then configure the non-secret model settings:

```powershell
Set-Location C:\Users\FATIMA\GitHub\store-scout-persian-intent
uv sync --locked
# Run this import only if you need a new sample Catalog:
# uv run --no-sync store-scout import-data datasets/sample --source-kind sample
$env:STORE_SCOUT_LLM_MODEL = 'gpt-6.1-sol'
$env:STORE_SCOUT_LLM_OUTPUT_LIMIT_PARAMETER = 'max_completion_tokens'
$env:STORE_SCOUT_LLM_EXTRACTION_MAX_TOKENS = '1024'
uv run --no-sync python -c "import getpass,os,warnings; from torob.cli import main; warnings.simplefilter('error',getpass.GetPassWarning); os.environ['STORE_SCOUT_LLM_API_KEY']=getpass.getpass('BoxAPI key (hidden): '); raise SystemExit(main(['serve']))"
```

The Python process holds the key locally and does not export it to the parent
shell or save it. This launcher is for an interactive console where getpass can
hide input. The server listens on the existing default `127.0.0.1:8000`. Starting
the server makes no provider request; submitting text to create/revise does and
may consume credit. Do not use live extraction as part of automated testing.

## API for the future conversational frontend

All paths start with `/api/v1/journey/intents`. Responses are JSON. Render every
user/evidence/summary string as plain text; never interpret it as HTML or code.
The maximum HTTP body is 16 KiB and a message is at most 2000 characters.

| Method and suffix | Body | Response |
| --- | --- | --- |
| `POST` (no suffix) | `{"message":"گوشی سامسونگ تا ۳۰ میلیون تومان"}` | 201: `{draft, access_token}` |
| `GET /{draft_id}` | None | Current `IntentView` |
| `POST /{draft_id}/revise` | `{expected_revision, message}` **or** `{expected_revision, changes}` | New unconfirmed revision |
| `POST /{draft_id}/confirm` | `{"expected_revision":1,"confirm":true}` | Confirmed view; does not search |
| `POST /{draft_id}/reject` | `{"expected_revision":1}` | Rejected view, revision advanced |
| `POST /{draft_id}/recommendations` | `{"expected_revision":1}` | Existing `JourneyRecommendations` |

Every operation after creation requires
`Authorization: Bearer <access_token returned by draft creation>`. This token
is a per-draft capability, **not the BoxAPI key**. It is returned only once,
stored hashed and never accepted in a URL. Keep it in the frontend session and
out of logs and shared links. Responses use `Cache-Control: no-store`; CORS
permits Authorization for the application's configured origins.

`IntentView` includes:

- `draft_id`, monotonic `revision`, Unix `expires_at` and `status`.
- `fields`: raw interpreted values and explicitly supplied map coordinates.
- Per-field `provenance`: `model_interpretation` or `user_supplied`, with evidence.
- `max_budget` / `min_budget`: original text, normalized exact value/currency,
  whole toman where resolved, and `requires_clarification`.
- `criteria`: a **preview**, using the existing Journey model. It is not execution
  authorization. Do not automatically POST this preview to the legacy endpoint.
- `issues`, a focused `next_question`, deterministic `summary`, and notices.

Draft states are `needs_clarification`, `awaiting_confirmation`, `confirmed`,
`rejected` and `invalid` (irrelevant input, which can be revised). A creation or
revision runs extraction/preparation; it never runs Catalog search. Malformed
model output returns a safe error without creating a draft. A failed revision
leaves the previous persisted version and decision intact.

To answer missing information or explicitly revise a field:

```json
{
  "expected_revision": 0,
  "changes": {
    "max_budget": "۳۰ میلیون تومان",
    "coordinates": {
      "latitude": 35.7,
      "longitude": 51.4,
      "for_location": "ونک"
    },
    "radius": "۵ کیلومتر",
    "warranty": "ترجیحاً گارانتی"
  }
}
```

These coordinates are an illustrative **user map selection**, not a claim that
this point is Vanak. When a location label is present, `for_location` must match
that exact retained label. The backend never chooses a neighborhood centroid.
Changing the label discards previously selected coordinates. A frontend should
ask the user to choose the actual center on a map and display the circle.

For a natural clarification send, for example,
`{"expected_revision":0,"message":"منظورم ۳۰ میلیون تومان بود"}`. Provide the
complete clarified money expression, including unit and magnitude. Interpretation
uses the current message only; it never guesses omitted units from context.
Unmentioned fields are retained. Natural-language nulls never erase constraints;
use explicit `changes` with null to clear a scalar, or `[]` to clear
`other_preferences`. Revisions always require renewed confirmation, even after
previous confirmation or rejection. A natural “yes/confirmed” is never approval.

Review the full summary and notices before submitting `confirm:true`. Confirmation
binds to the server-stored draft/version. Stale revisions return 409. Requests
cannot supply replacement criteria or a model-generated confirmation flag at
confirmation/execution time. Database transactions serialize revision decisions
across app workers, including the confirmed handoff to Journey. Execution may be
explicitly repeated for the same confirmed version; results are not cached in
the draft. `search_performed:false` on draft views describes preparation, not a
history of prior executions; execution returns the canonical searched state.

The legacy typed `/api/v1/journey/recommendations` endpoint stays compatible for
existing form/controller clients. This workflow's model output uses the new
confirmation-gated execution endpoint.

## Supported values and honest limitations

- Persian/Arabic digits and mixed Persian/English product text are supported.
  Exact source spans are checked; invented brands, coordinates, tools and extra
  properties are rejected. Known currency/preference mentions cannot simply be
  omitted from an otherwise accepted model response.
- Money supports decimal/thousands notation, common Persian written numbers,
  هزار/میلیون/میلیارد and explicit تومان/ریال. Decimal arithmetic and canonical
  conversion avoid float widening. `۳۰ تومن` and `۴۰ میلیون` remain ambiguous;
  no colloquial magnitude or currency default is inferred. Invalid/negative,
  zero, non-finite and out-of-range values are rejected.
- A usable product query, maximum budget, user-selected coordinates and explicit
  radius (greater than zero, at most 100 km) are required. Distances may be in
  meters or kilometers. No default search center or radius is invented.
- Brand/category are retained as annotations and query terms. They are not new
  normalized hard filters or semantic matching guarantees.
- Catalog has a minimum-price filter, but the existing Recommendation/Journey
  adapter cannot enforce a minimum. It is retained and blocks confirmation until
  explicitly removed; it is never silently dropped.
- Warranty, installments and return-window days can be soft preferences through
  existing `PurchaseConditions`. Mandatory/negative constraints block confirmation
  until explicitly removed or changed to a preference. Neutral wording asks whether
  the condition is mandatory or preferred. Existing ranking does not certify
  warranty/returns; its limitations remain visible. Unsupported other preferences
  are retained and block execution. No ranking algorithm is changed.
- No geocoder, store/product fabrication, seller contact or inventory verification
  is implemented. All factual results come from the actual Catalog and retain
  its dataset provenance, limited coverage and unconfirmed stock.

Local JSON validation rejects unknown fields, coercible wrong types, duplicates,
non-finite JSON constants and inconsistent budget ranges. Empty, malformed,
truncated, filtered or unfinished completions fail safely. Prompt isolation plus
evidence validation limits injection impact; it does not prove semantic model
accuracy. Human review/confirmation remains required.

## Persistence, reliability and security boundary

Drafts are stored in a separate SQLite file next to the configured Catalog DB:
`catalog.sqlite3` → `catalog.intent.sqlite3`. No Catalog tables are modified.
Drafts survive service restarts and multiple workers sharing that file. TTL is
24 hours; expired rows are inaccessible and purged on later creation. Capacity
is 1000 live drafts; no existing draft is evicted to create another. The DB holds
shopping evidence and coordinates; protect it like application data. Complete
conversation messages and provider credentials are not persisted.

There are at most two simultaneous provider calls per process and ten attempted
interpretations per fixed minute across workers sharing the SQLite file. Failed
provider calls count. Each message invocation makes one request, with no retries,
parameter/model switching, paid repairs, discovery or expensive fallback. These
are bounded local controls, not user account quotas or a distributed service.
The existing app has no account login: keep it local/private or place it behind
an authenticated ingress before exposing paid interpretation publicly. Draft
capabilities isolate sessions but do not authenticate draft creation.

Existing verified HTTPS, 15-second default socket timeout/shrinking operation
deadline and 64 KiB response-body limit remain. OS DNS/header parsing retains the
standard-library limitations described in the [client guide](../llm/README.md).
Errors never include raw model output, credentials, headers, exception strings
or traceback locals. Codes use the existing `{error:{code,message,details}}`
envelope. Provider failures do not disable Catalog, health or typed Journey routes.

Interpretation rejection warnings now identify the first rejecting guard using
only allowlisted reason/finish/field names and the actual supplied token cap where
available. Public errors remain fixed. No input, completion, credential, header,
capability or traceback is logged. See
[the diagnosis report](../../../../docs/INTENT_INTERPRETATION_DIAGNOSIS.md) for the
reported 40-million-toman intake, offline regression evidence, metadata meanings
and what to capture from the next user-triggered attempt. The exact reported live
cause and live recovery remain unverified; no model/token/validation change is
justified by the screenshot alone.

Relevant HTTP failures: 422 invalid user request/criteria, 404 unavailable token/
draft/expiry, 409 stale or unconfirmed version, 413 body too large, 429 local/provider
rate limit, 502 invalid/incomplete model response, 503 configuration/provider/storage
unavailability, 504 timeout. Authentication and model-access provider codes remain
distinguishable as `llm_authentication` and `llm_model_access`, without exposing secrets.

## Offline verification

From the worktree after `uv sync --locked`:

```powershell
uv run --no-sync python -m torob.journey.intent.demo
uv run --no-sync pytest tests/intent src/torob/journey/llm/tests
uv run --no-sync pytest tests src/torob/journey/tests src/torob/journey/llm/tests
uv run --no-sync ruff check .
uv run --no-sync ruff format --check .
uv run --no-sync python scripts/export_contracts.py --check
```

The demo uses an injected fixture transport and real temporary sample Catalog
through the actual registered HTTP application. It never reads the real key or
contacts BoxAPI. Tests similarly block production HTTPS and exercise real sample
Catalog handoff, errors, persistence and stale/concurrent confirmation. CI now
runs the Journey and LLM suites too. Mocked extraction evidence establishes local
handling and integration, not Persian model quality or live extraction success.

Next stage: connect these contracts to the existing frontend controller, provide
the map/radius selection, plain-text clarification and summary review, carry the
capability token and revision through requests, and render the unchanged canonical
results. After separate explicit approval, evaluate real-model extraction on a
small Persian fixture corpus; record accuracy/ambiguity/truncation separately from
mocked tests and from the previously successful provider connectivity smoke.
