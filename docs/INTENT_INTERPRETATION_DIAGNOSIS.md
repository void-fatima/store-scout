# Conversational intake rejection diagnostics — 2026-10-23

## Established facts and remaining uncertainty

Reported message: `گوشی سامسونگ تا 40 میلیون تومان میخوام`.
Reported UI text maps to `invalid_interpretation` (HTTP 502) in
`frontend/src/api/intent.ts`. The user has no captured runtime metadata or model
completion for that event. The deployed revision, actual finish reason, active
token cap and rejected field remain unknown. **The exact live cause is unresolved,
and live-provider recovery is unverified.** No paid/model request was made.

Before implementation, fetched/verified current `origin/main` at
`ca1dc41f15c20bf34bbef86e1aeb62257ae81280`, inspected local/remote intent branches,
worktrees, recent fixes and open PRs (none), and created the separate topic
`fix/intent-interpretation` in
`C:/Users/FATIMA/GitHub/store-scout-intent-interpretation`. No applicable
ancestor/intent AGENTS.md exists. Other sessions' checkouts/processes and deployment
worktrees were left unchanged.

Tested implementation commit: `30df12844ac24671be438879bed0a2e91167c19e`.
The documentation-only commit follows it. Delivery is a draft PR against main;
no merge or deployment is part of this task.

Source inspection and pre-change offline reproduction establish:

- A valid completion for the exact message and its Persian-digit equivalent
  (`۴۰`) already produces `needs_clarification`, budget `40000000` / `TOMAN`,
  missing point/radius issues and `search_performed=false`. Confirm and execution
  remain blocked. Missing location/radius is **not itself an interpretation error**.
- Many guards previously collapsed into the same `invalid_interpretation` error
  without recording which guard rejected the completion. That diagnostic gap is
  established; a specific provider-output defect is not.
- In the real `BoxAPIClient` path, `finish_reason=length` is rejected *before*
  extraction as `llm_incomplete_response`; content filtering or another non-stop
  finish normally becomes `llm_malformed_response`. These map to different UI
  fallback text. A missing finish reason reaches extraction and can produce the
  reported error. This does not prove any finish reason for the observed event.
- A malformed JSON completion with `stop`, a schema failure, evidence mismatch,
  omitted monetary evidence, another consistency guard or a subsequent
  normalization rejection can also produce the reported error. The screenshot
  cannot distinguish them.

## Narrow fix

The change fixes the loss of rejection diagnostics, **not a proven provider
acceptance bug**. Model selection, prompt, token defaults/ranges, acceptance
criteria, currency/evidence validation, HTTP error contracts, confirmation flow
and frontend error mapping remain unchanged. There is no fallback interpretation,
field repair/discard, automatic retry or search during intake.

`torob.journey.intent.diagnostics` emits one WARNING for the first rejecting guard.
The message contains only a fixed reason, allowlisted finish reason, bounded token
cap and allowlisted field names. Extraction logs the cap actually supplied to
that completion call, not a guessed environment default. `LLMError` retains only
sanitized finish metadata on completion-framing failures; its public `as_dict`,
HTTP code and messages are unchanged.

| Reason | Boundary / interpretation |
| --- | --- |
| `non_stop_finish_reason` | Extraction received a finish reason other than `stop`, including a missing reason. |
| `invalid_json` | Completion content is not strict JSON; duplicate keys and non-finite JSON constants remain rejected. |
| `schema_validation` | Required keys, types, lengths, list bounds or extra-field rules failed. |
| `evidence_span_mismatch` | A non-null evidence span is empty after normalization or absent from the normalized current message. |
| `irrelevant_fields` | `shopping_related=false` conflicts with nonempty extracted fields. |
| `preference_evidence` | Warranty/installments/return evidence was omitted or assigned to the wrong field. |
| `missing_monetary_evidence` | Monetary wording exists but both budget evidence fields are missing. |
| `criteria_normalization` | The valid extraction was rejected by existing deterministic preparation during draft creation. |
| `empty_revision` | A natural-language follow-up provided no explicit field updates. |
| `llm_<existing error code>` | Completion client rejected transport, framing or finish status before extraction. |

Finish values are restricted to `stop`, `length`, `content_filter`, `tool_calls`,
`function_call`, `missing`, `other` or `unavailable`. Arbitrary provider values are
never logged. `missing` means a parsed completion lacked that metadata;
`unavailable` means no completion metadata is available at that boundary.
Schema diagnostics retain only known top-level contract field names, using
`__root__` / `__unknown__` for root errors or untrusted extra keys. No validation
messages, input values or exception tracebacks are logged.

Post-extraction `criteria_normalization` and `empty_revision` checks do not own
completion metadata; they report `finish_reason=unavailable`,
`max_output_tokens=unavailable`, `fields=-` rather than inventing a finish/cap or
attributing the failure to every non-null field. Further field-level diagnosis
would need evidence from that particular guard. Public API responses intentionally
keep the original fixed errors and empty details.

## Safe metadata for the next user-triggered attempt

After this change is separately reviewed/deployed, let the user submit once through
the normal UI. This task does **not** authorize or trigger a paid attempt or deploy.
Inspect only the `intent_interpretation_rejected` WARNING line from the server's
standard application logs. For example, this is a **synthetic test example**, not
observed production metadata:

```text
intent_interpretation_rejected reason=schema_validation finish_reason=stop max_output_tokens=1024 fields=max_budget
```

Share only those four safe values plus the deployed commit and HTTP error code.
The reason identifies the guard; field names identify the rejected contract slot
where available. A missing/unknown value must remain unknown. Do not enable HTTP
body/header logging, traceback-local dumping or request recording. Never collect
user messages, raw completions, credentials, capability tokens, headers or model
configuration strings. No request correlation ID or user/draft identifier is added
by this instrumentation.

## Verification

Actual checks completed on Windows / Python 3.13 with the locked environment:

| Check | Result |
| --- | --- |
| Focused intent + LLM tests | 293 passed, zero skips |
| Full backend / Journey / LLM regression | 775 passed, zero skips |
| Ruff lint and format | Passed |
| Backend canonical contract drift check | Passed |
| Frontend `contracts:check` and `intent:check` | Both passed |
| Clean frontend install for generators | 132 audited packages, zero vulnerabilities; lockfile unchanged |

The focused tests are a subset of the full suite. Pytest reports one existing
Starlette/TestClient `httpx` deprecation warning; no dependency change or warning
suppression was made. No UI source changed, so browser/layout checks were not
repeated. Whitespace checks pass; schema/model/normalizer, frontend API mapping,
generated bindings, lockfiles and model/token configuration remain unchanged.

The tests use an injected **completion transport**, not an interpreter that bypasses
the production parser. They run `BoxAPIClient → LLMInterpreter → IntentService →
actual FastAPI routes` with disposable sample Catalog/intent databases. Provider
HTTPS connections are forbidden by the existing autouse test fixture.

- Two observed-message ASGI regression cases ran successfully **before** the
  change, establishing clarification and explicit currency handling on main.
- New diagnostic cases cover missing/length/filtered/hostile finish values,
  malformed/truncated JSON, duplicate keys/non-finite constants, schema/type/extra
  fields, evidence mismatch, missing money, preference evidence, normalization,
  empty revision, timeout and valid/no-warning behavior. Sensitive sentinel values
  and unknown schema keys must never appear in logs; one completion/no retry is
  asserted. A separately configured 2048-token fixture verifies that the logged
  cap is the actual supplied cap without changing production defaults.
- Five new loopback HTTP cases start the real app with Uvicorn on an ephemeral
  `127.0.0.1` socket, use `http.client` without proxies/credentials and stop only
  that test-owned server. Both digit forms clarify with budget `40000000`/`TOMAN`;
  confirmation/recommendations remain 409 and Catalog search count remains zero.
  Broken `stop`, `length` and missing-finish fixtures return the original 502 codes,
  sanitized diagnostics and zero persisted drafts/searches.
- These checks verify offline application behavior and observability. **Fixture
  success does not establish live extraction accuracy or recovery.** No live
  provider output was available, and no live request was attempted.

Run from the repository root:

```powershell
uv sync --locked
uv run pytest tests/intent src/torob/journey/llm/tests -ra
uv run pytest tests src/torob/journey/tests src/torob/journey/llm/tests -ra
uv run ruff check .
uv run ruff format --check .
uv run python scripts/export_contracts.py --check
```

From `frontend/`, run `npm.cmd ci`, `npm.cmd run contracts:check` and
`npm.cmd run intent:check`. No frontend/generated contract change is intended.
