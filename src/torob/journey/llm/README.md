# Standalone BoxAPI client (backend stage 1)

This module establishes a provider connection boundary. **The application does
not yet use the model.** There is no new route, shopping extraction, ranking,
frontend chat, tool calling or structured-output dependency.

The current main application already registers
`POST /api/v1/journey/recommendations` in `torob.api.create_app`. Historical
"unregistered" comments elsewhere do not describe that current wiring.

## Configuration and secret handling

Production configuration is read when `LLMConfig.from_env()` is explicitly
called. Importing the module and constructing a client do not read credentials
or contact a provider. The opt-in smoke CLI also reads these three variables.

| Variable | Meaning |
| --- | --- |
| `STORE_SCOUT_LLM_API_KEY` | Required server-side bearer credential; never put it in frontend configuration. |
| `STORE_SCOUT_LLM_BASE_URL` | Defaults to `https://ai.boxapi.ir/ai/v1`. Custom values must be trusted HTTPS endpoints without userinfo, query or fragment. |
| `STORE_SCOUT_LLM_MODEL` | Required exact model ID with text/chat support and access in your own account. No default or fallback model. |

[.env.example](.env.example) is a placeholder reference. **This module does not
load `.env` files.** Saving that file or copying it to `.env` does not configure
the process. For a server, inject these variables with your process manager or
secret manager. Do not log environment values, HTTP headers, request bodies,
traceback locals or configuration dictionaries. Normal object representations
hide operator-supplied strings; `LLMError.as_dict()` contains only fixed codes
and messages. Error bodies and original exception contexts are discarded.

## Manually test a real connection

From this worktree in an interactive PowerShell terminal:

```powershell
Set-Location C:\Users\FATIMA\GitHub\store-scout-boxapi-client
uv sync --locked
uv run --no-sync python -m torob.journey.llm.smoke --live
```

The command asks for a missing non-secret model ID, a verified output-limit
parameter, and a missing key via **hidden `getpass` input**. Never paste the key
into chat, a command argument, Git, or an example file. The key stays local to
this command and is not saved to disk or exported into the parent environment.
If secure terminal input is unavailable, the command refuses echoing fallback.

Check your selected model's documentation/account access first. Choose
`max_tokens` or `max_completion_tokens` only if supported by that model through
BoxAPI. You can pass the verified choice explicitly:

```powershell
uv run --no-sync python -m torob.journey.llm.smoke --live --output-limit-parameter max_tokens
```

That example applies **only to a model verified to support `max_tokens`**. The
command sends one user message, `لطفاً فقط بنویس: سلام`, with an output cap of
**64 tokens**. It never retries, changes models or tries another parameter.
The cap must fit the chosen model's documented limits; reasoning models may
consume their allowance without producing visible text and fail this smoke
test. A failed request may still consume credit. No automatic model-discovery
requests are made.

The [BoxAPI AI documentation](https://boxapi.ir/docs/ai) documents the base URL,
`POST /chat/completions`, bearer authentication and standard SDK compatibility.
It does **not** document model-specific output-limit support. The standard
[chat completion parameter reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
documents `max_completion_tokens` and the older `max_tokens`, including model
compatibility restrictions. That reference is not evidence that every BoxAPI
model supports either parameter. Verify the chosen model before live use;
there is intentionally no implicit parameter selection. Model IDs in provider
examples or the [BoxAPI model list](https://boxapi.ir/docs/ai/models/) are not a
guarantee of access in your account.

Without `--live`, this command does not read configuration, prompt, construct a
client or contact any provider, even if credentials are already in the environment:

```powershell
uv run --no-sync python -m torob.journey.llm.smoke
```

In noninteractive sessions there are no prompts: configure key/model in the
server environment and supply `--output-limit-parameter` explicitly. Exit codes:
`0` = offline/no request or live success (distinguished in output), `1` = safe
configuration/provider failure, `2` = CLI/input/parameter selection failure.
Success means one valid, nonempty assistant text completion was received;
provider text, headers and operator-supplied values are not printed.

## Client boundary and diagnostics

`BoxAPIClient(config, transport=...)` accepts an injected `Transport` for tests
or a future application-owned transport. Call
`complete(text, output_limit_parameter=OutputLimitParameter.MAX_TOKENS)` only
after verifying that choice for the configured model. Results expose `.text`.
The fixed default cap is 64 tokens; explicit client caps must be 16–256. Input
is limited to 4,000 characters. Completion representations hide text, and exact
credential echoes in returned text are replaced with `[REDACTED]`.

The production transport uses standard-library `http.client.HTTPSConnection`
with default TLS certificate/hostname verification. It makes one direct HTTPS
POST, closes the connection, refuses redirects, requests identity encoding and
rejects compressed responses. It does not consume proxy/netrc credentials.
No production dependency or shared configuration was added. The existing
Catalog client only defines an injectable GET interface; dev-only `httpx` is
not used here.

Defaults are a **15-second socket timeout** and a **65,536-byte response body
limit**. Constructor overrides allow `(0, 60]` seconds and `1–1,048,576` bytes.
Content-Length is checked before body reads; unknown-length bodies are read
incrementally up to the limit plus one detection byte. A shrinking deadline is
applied between connect/write/header/body operations and body chunks. This is
not a process-wide hard wall-clock guarantee: OS DNS resolution and internal
header parsing remain subject to standard-library/platform behavior. Injected
transports must enforce the same resource limits.

| Error code | Interpretation |
| --- | --- |
| `missing_api_key`, `missing_model`, `invalid_configuration` | Local configuration must be corrected. |
| `authentication` | HTTP 401; check the key locally. |
| `model_access` | HTTP 403/404, or an allowlisted model error code on HTTP 400. Check account permissions, exact model and endpoint; status alone cannot prove which one is wrong. |
| `rate_limit` | HTTP 429; no retry. |
| `timeout` | Socket/deadline timeout or HTTP 408/504; no retry. |
| `billing_required` | HTTP 402; check available credit/billing. |
| `malformed_response`, `response_too_large` | Invalid text payload/framing/encoding, or body cap exceeded. |
| `redirect_refused`, `request_rejected`, `provider_unavailable`, `transport_error` | Fixed diagnostics with no raw upstream data; check endpoint, model parameter support or provider availability. |

Unknown upstream prose is never used to guess a model/authentication error.
No retries or expensive fallbacks occur for any error.

## Verification and next-stage handoff

Offline checks (all module tests block real network access):

```powershell
uv run --no-sync pytest src/torob/journey/llm/tests
uv run --no-sync pytest tests src/torob/journey/tests src/torob/journey/llm/tests
uv run --no-sync ruff check .
uv run --no-sync ruff format --check .
uv run --no-sync python scripts/export_contracts.py --check
```

**Live verification is pending** until an operator supplies an accessible model,
verified output-limit parameter and real key and observes live success. Mocks
establish request handling and safety properties, not BoxAPI connectivity.

Next stage: extract a shopping **draft** from Persian input, validate it using
the existing Journey criteria models, ask for missing/ambiguous information,
and obtain explicit confirmation of criteria (including budget units, location,
radius and any changes). Only confirmed criteria should enter the existing
Journey/Catalog/Recommendation flow. Preserve Recommendation's retrieval and
ranking ownership. This stage implements none of that extraction or UI wiring.
