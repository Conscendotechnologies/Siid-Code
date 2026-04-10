# Roo-Code OpenRouter Caching and Reasoning Analysis

## Scope

This report answers three questions about the current Roo-Code codebase:

1. Does Roo-Code implement prompt caching for OpenRouter?
2. How does the OpenRouter path handle streamed chunks?
3. How does Roo-Code extract thinking/reasoning for models that do not send it in a dedicated reasoning block?

The analysis is based on the current `main` branch source, primarily under:

- `src/api/providers/openrouter.ts`
- `src/api/providers/base-openai-compatible-provider.ts`
- `src/api/transform/openai-format.ts`
- `src/api/transform/caching/anthropic.ts`
- `src/api/transform/caching/gemini.ts`
- `src/api/providers/deepseek.ts`
- `src/core/task/Task.ts`
- `src/core/task-persistence/apiMessages.ts`
- `packages/types/src/providers/openrouter.ts`
- `src/api/providers/fetchers/openrouter.ts`

---

## Executive Summary

### 1. Prompt caching for OpenRouter

Yes. Roo-Code does implement prompt caching for OpenRouter, but it is not completely dynamic.

- At model discovery time, Roo marks an OpenRouter model as `supportsPromptCache` when OpenRouter pricing metadata includes cache read pricing.
- At request time, Roo only injects actual OpenRouter cache breakpoints for models in a hardcoded allowlist: `OPEN_ROUTER_PROMPT_CACHING_MODELS`.
- For Anthropic-family OpenRouter models, Roo marks the system prompt and the last two user messages with `cache_control: { type: "ephemeral" }`.
- For Google/Gemini OpenRouter models, Roo marks the system prompt and then every Nth user message (default every 10th user message).

So the practical answer is:

- `Yes, prompt caching exists for OpenRouter.`
- `It is automatically applied for selected models.`
- `It is not driven solely by runtime model metadata.`

There is a second OpenRouter-specific nuance for OpenAI GPT-family models:

- OpenRouter documentation says OpenAI prompt caching is implicit and automatic.
- That means GPT models on OpenRouter do not need explicit `cache_control` block markers the way Anthropic and Gemini do.
- In Roo-Code, `OPEN_ROUTER_PROMPT_CACHING_MODELS` behaves like an explicit-breakpoint allowlist, not a general list of every OpenRouter model that can benefit from caching.

### 2. Stream chunk handling

The OpenRouter provider uses a custom stream parser rather than the shared `BaseOpenAiCompatibleProvider` stream logic.

It handles:

- provider errors embedded inside the stream
- `reasoning_details[]` chunks
- top-level `delta.reasoning`
- streamed tool calls
- finish reasons that require synthetic `tool_call_end` events
- usage metadata including cached token counts and reasoning token counts

### 3. Extracting thinking for models that do not emit a reasoning block

Roo-Code has multiple fallback strategies across the codebase, but they are not all used by OpenRouter.

- The shared OpenAI-compatible path extracts reasoning from `reasoning_content`, then `reasoning`, and also strips `<think>...</think>` tags out of normal text streams.
- The DeepSeek path explicitly supports `reasoning_content` and preserves it across tool call turns.
- The OpenRouter-specific path only reads `reasoning_details[]` and top-level `reasoning`.

That means:

- `Roo-Code as a project does support several fallback reasoning formats.`
- `The dedicated OpenRouter handler does not currently use all of those fallbacks.`

If an OpenRouter-routed model emits reasoning only as `reasoning_content` or hidden inside `<think>` tags in `content`, this specific handler would not extract it unless OpenRouter first normalizes it into `reasoning_details` or top-level `reasoning`.

On the UI side, Roo renders recognized reasoning as a dedicated `Thinking` block, collapsed by default, and updates that same block in place while streaming.

---

## Detailed Findings

## A. OpenRouter Prompt Caching

### A1. How Roo decides a model supports caching

OpenRouter model discovery happens in `src/api/providers/fetchers/openrouter.ts`.

Key behavior:

- Roo parses `input_cache_write` and `input_cache_read` pricing fields from the OpenRouter model catalog.
- It sets `supportsPromptCache` to `true` when `input_cache_read` exists.
- This is metadata-level capability detection only.

Implication:

- The UI and model info can correctly show that a model supports caching.
- But this alone does not guarantee Roo will inject cache-control breakpoints in the request.

### A2. How Roo actually enables caching in OpenRouter requests

The request path is implemented in `src/api/providers/openrouter.ts`.

Before the request is sent, Roo checks whether the model ID is in `OPEN_ROUTER_PROMPT_CACHING_MODELS` from `packages/types/src/providers/openrouter.ts`.

If the model is allowlisted:

- Google models use `addGeminiCacheBreakpoints()`.
- All other allowlisted OpenRouter caching models use `addAnthropicCacheBreakpoints()`.

This mutates the outgoing OpenAI-style messages by adding `cache_control: { type: "ephemeral" }` to selected text parts.

### A3. Anthropic strategy vs Gemini strategy

Anthropic-style strategy in `src/api/transform/caching/anthropic.ts`:

- Always caches the system prompt.
- Converts string user messages into array content blocks if needed.
- Adds cache control to the last two user messages.

Gemini-style strategy in `src/api/transform/caching/gemini.ts`:

- Always caches the system prompt.
- Converts user string content into array blocks if needed.
- Adds cache control every `frequency` user turns, default `10`.

This means Roo uses different cache breakpoint placement rules for different OpenRouter model families.

### A4. Important implementation gap

There is a real mismatch between capability detection and runtime enablement:

- capability detection is dynamic and based on OpenRouter pricing metadata
- runtime cache breakpoint injection is static and based on a hardcoded allowlist

Implication:

- A newly supported OpenRouter model may show `supportsPromptCache: true` but still not receive cache-control markers unless someone also adds it to `OPEN_ROUTER_PROMPT_CACHING_MODELS`.

This is the single most important architectural caveat in Roo-Code's OpenRouter caching implementation.

### A5. Is there a user toggle for OpenRouter caching?

In the request-building path I inspected, caching is automatic for allowlisted models. I did not find an OpenRouter-specific request-time toggle in `src/api/providers/openrouter.ts`.

So the behavior today appears to be:

- supported + allowlisted model => cache markers injected automatically
- unsupported or non-allowlisted model => no cache markers injected

### A6. OpenRouter docs: OpenAI GPT caching is implicit

OpenRouter's prompt caching docs make an important distinction that is not represented directly in Roo's current runtime logic.

According to OpenRouter:

- OpenAI prompt caching is automatic.
- It does not require explicit `cache_control` configuration.
- There is a minimum prompt size of 1024 tokens.
- OpenRouter uses provider sticky routing to keep subsequent requests on the same provider path after a cached request.

This means that for OpenRouter GPT-family models, "supporting prompt caching" is not the same thing as "injecting cache breakpoints".

### A7. What this means for adding OpenAI GPT models in Roo-Code

If the goal is to improve OpenRouter support for OpenAI GPT prompt caching, the most important conclusion is this:

- you probably should not add GPT models to `OPEN_ROUTER_PROMPT_CACHING_MODELS` just because they support caching

Why:

- Roo currently uses that set to trigger explicit message mutation via `cache_control`
- OpenRouter docs say OpenAI caching is implicit and needs no explicit breakpoints
- Anthropic and Gemini are the families where Roo's current breakpoint helpers are clearly appropriate

The cleaner design is to separate:

- implicit caching families like OpenAI and DeepSeek
- explicit breakpoint families like Anthropic and Gemini

### A8. Recommended design for OpenRouter caching support

A better long-term design would be to replace the single explicit-breakpoint set with a cache strategy model such as:

- `implicit`
- `anthropic-explicit`
- `gemini-explicit`
- `none`

Then Roo could:

- leave OpenAI GPT requests untouched and rely on OpenRouter/OpenAI implicit caching
- keep explicit breakpoint injection for Anthropic and Gemini
- still surface `supportsPromptCache` from model metadata for UI/accounting

### A9. OpenRouter cache metrics vs Roo usage reporting

OpenRouter docs say cache usage can appear in `usage.prompt_tokens_details` with at least:

- `cached_tokens`
- `cache_write_tokens`

Roo's OpenRouter handler currently reports:

- `cacheReadTokens` from `cached_tokens`

But it does not currently surface:

- `cacheWriteTokens` for OpenRouter

So implicit GPT caching on OpenRouter may already work at the provider layer even if Roo is not fully surfacing all cache accounting details in its own internal usage event.

---

## B. OpenRouter Stream Chunk Handling

## B1. Stream setup

OpenRouter requests are built as streaming chat completion calls with:

- `stream: true`
- `stream_options: { include_usage: true }`

The handler also optionally attaches:

- OpenRouter provider routing constraints via `provider.order`, `provider.only`, `allow_fallbacks: false`
- reasoning params when the selected model/settings require them
- Anthropic beta headers for fine-grained tool streaming on `anthropic/*` models

## B2. Error handling during streaming

The handler explicitly notes that OpenRouter may return an error object inside the stream instead of throwing through the SDK.

Runtime behavior:

- each streamed item is checked for an `error` field
- if found, Roo extracts the best possible message
- Roo also parses `error.metadata.raw` when available
- telemetry is recorded before the error is thrown

This is more defensive than a normal OpenAI-compatible stream loop.

## B3. Reasoning chunk handling

The OpenRouter handler gives priority to `delta.reasoning_details`.

Behavior:

- if `reasoning_details[]` exists, Roo accumulates entries by `type` and `index`
- text-bearing reasoning details are streamed to the UI as `type: "reasoning"`
- encrypted reasoning blocks are preserved in memory but not displayed
- after the stream completes, accumulated entries are consolidated and stored via `getReasoningDetails()`

The consolidation logic in `src/api/transform/openai-format.ts`:

- drops corrupted encrypted reasoning entries without `data`
- concatenates `text` fragments
- concatenates `summary` fragments when text is absent
- keeps the last encrypted `data` block for each index

This is important because Roo is preserving structured reasoning for conversation continuation, not just rendering it.

## B4. Duplicate avoidance between `reasoning_details` and top-level `reasoning`

After processing `reasoning_details`, the OpenRouter handler checks top-level `delta.reasoning`.

But it only emits top-level `reasoning` if Roo has not already emitted displayable text from `reasoning_details`.

That avoids duplicate reasoning display when OpenRouter sends both representations.

## B5. Tool call chunk handling

Tool calls are not fully assembled inside the provider.

Instead, Roo streams raw partial tool call chunks:

- `type: "tool_call_partial"`
- includes index, id, function name, and argument fragments

Then, when a `finish_reason` arrives, Roo calls `NativeToolCallParser.processFinishReason()` to emit any required `tool_call_end` events.

This is a good separation of concerns:

- provider emits low-level raw tool-call deltas
- `NativeToolCallParser` owns completion/finalization semantics

## B6. Text and usage handling

For plain content:

- `delta.content` is emitted directly as `type: "text"`

For usage:

- Roo waits until the end of the stream
- it records the last usage block seen
- then yields a usage chunk with:
    - `inputTokens`
    - `outputTokens`
    - `cacheReadTokens`
    - `reasoningTokens`
    - `totalCost`

Notable detail:

- `totalCost` is calculated as `upstream_inference_cost + cost`
- this is specific to OpenRouter's billing metadata shape

---

## C. How Roo Extracts Thinking When There Is No Dedicated Reasoning Block

This part requires separating `Roo-Code overall` from `OpenRouter specifically`.

## C1. Shared OpenAI-compatible fallback path

The shared implementation in `src/api/providers/base-openai-compatible-provider.ts` has two major fallbacks.

### Fallback 1: `reasoning_content` or `reasoning`

For each streamed delta, Roo checks in order:

1. `reasoning_content`
2. `reasoning`

The first non-empty one gets emitted as a reasoning chunk.

This supports providers that expose thinking outside of OpenRouter's `reasoning_details` format.

### Fallback 2: `<think>...</think>` tags inside normal text

The same base class also uses `TagMatcher` from `src/utils/tag-matcher.ts`.

Behavior:

- incoming `delta.content` text is scanned incrementally
- text inside `<think>...</think>` becomes `type: "reasoning"`
- surrounding text becomes normal `type: "text"`

This is how Roo handles providers that embed reasoning inline in content rather than sending a separate reasoning field.

## C2. DeepSeek-specific reasoning extraction

`src/api/providers/deepseek.ts` goes further.

It explicitly handles DeepSeek's interleaved reasoning model by:

- reading `delta.reasoning_content`
- emitting it as reasoning chunks
- using `convertToR1Format()` with `mergeToolResultText` so reasoning survives tool-call continuations

This exists because DeepSeek drops historical `reasoning_content` if a new user message is introduced after tool results.

Roo compensates for that in the message transformation layer.

## C3. What OpenRouter specifically does not do

The dedicated OpenRouter handler does not reuse the generic `BaseOpenAiCompatibleProvider` streaming parser.

So it does not currently:

- scan `delta.content` for `<think>...</think>` tags
- check `delta.reasoning_content`

It only handles:

- `delta.reasoning_details`
- top-level `delta.reasoning`

This is the most important answer to your second question.

If you are asking, "How does Roo extract thinking for models that do not send a reasoning block?", the precise answer is:

- Roo has fallback logic for that in the shared OpenAI-compatible path.
- The OpenRouter-specific path does not currently use those fallbacks.

### C3.1. OpenRouter docs and raw reasoning shapes

OpenRouter's reasoning docs describe two main output styles relevant here:

- top-level `reasoning`
- structured `reasoning_details`

They also note that:

- some reasoning models do not return their reasoning tokens at all
- `reasoning_content` can be used as an alias when preserving plain reasoning history back to the API

So from an OpenRouter-only perspective, Roo is strong on the documented structured reasoning formats, but not on every provider-shaped fallback that may still exist in practice.

### C3.2. If OpenRouter streams `<think>` tags inside content

For OpenRouter specifically, Roo does not parse those tags in `src/api/providers/openrouter.ts`.

So if an OpenRouter-backed model streams reasoning only inside `delta.content`, for example via `<think>...</think>`, then Roo will treat it as ordinary assistant text rather than as a dedicated reasoning stream.

## C4. Structured reasoning preservation across turns

Roo also persists reasoning metadata so it can be sent back on later turns.

Relevant behavior in `src/core/task/Task.ts` and `src/core/task-persistence/apiMessages.ts`:

- assistant messages can carry `reasoning_details`
- API history can also preserve `reasoning_content`
- when rebuilding conversation history, Roo preserves `reasoning_details` on assistant messages instead of flattening them into plain text

This matters for tool-use continuation, especially for Gemini/OpenRouter style reasoning signatures.

---

## D. OpenRouter Chunk Handling to UI

This section answers the more concrete question: once OpenRouter sends chunks, how do they become visible in Roo's chat UI?

## D1. Provider emits internal reasoning chunks

Inside `src/api/providers/openrouter.ts`, Roo maps OpenRouter stream data into internal `ApiStreamChunk` events.

For reasoning:

- `reasoning_details.reasoning.text` => internal `type: "reasoning"`
- `reasoning_details.reasoning.summary` => internal `type: "reasoning"`
- top-level `delta.reasoning` => internal `type: "reasoning"` only when no displayable reasoning has already been emitted from `reasoning_details`
- encrypted reasoning details are preserved for history continuity, but not shown to the user

For non-reasoning content:

- `delta.content` => internal `type: "text"`

## D2. Task-level streaming behavior

`src/core/task/Task.ts` consumes those provider chunks.

When it receives a `reasoning` chunk:

- it appends the chunk text into an in-memory `reasoningMessage` accumulator
- it applies a small formatting cleanup for certain bold section headers
- it calls `this.say("reasoning", formattedReasoning, undefined, true)`

That trailing `true` means the reasoning chat message is marked as partial.

## D3. One live reasoning row, updated in place

`Task.say()` has explicit behavior for partial messages.

If the last message is already a partial `say: "reasoning"` message:

- Roo updates that same message in place

If not:

- Roo creates a new partial reasoning message

So OpenRouter reasoning appears in the UI as one live-updating block, not as many tiny reasoning rows.

## D4. Chat row rendering

In `webview-ui/src/components/chat/ChatRow.tsx`, `say: "reasoning"` is routed to `ReasoningBlock`.

That component:

- labels the section `Thinking`
- shows a lightbulb icon
- is collapsed by default
- shows elapsed time while the last reasoning block is still streaming
- renders the expanded content using `MarkdownBlock`

This means OpenRouter reasoning is markdown-rendered once it reaches the UI.

## D5. Default UI state

In `ExtensionStateContext`, the default is:

- `reasoningBlockCollapsed: true`

So users do receive reasoning, but it is hidden behind a collapsible block by default.

## D6. What the user sees for different OpenRouter chunk shapes

### If OpenRouter sends `reasoning_details` or `reasoning`

Roo shows:

- a dedicated `Thinking` block
- updated live in place during streaming

### If OpenRouter sends only ordinary `content`

Roo shows:

- regular assistant text

### If OpenRouter-backed content contains `<think>` tags only

In the current OpenRouter handler, Roo still shows:

- regular assistant text

because OpenRouter does not currently use the shared tag-based fallback parser.

---

## E. Gemini and OpenRouter Special Handling

OpenRouter + Gemini gets extra logic that is worth calling out.

Before sending a request to a Gemini model through OpenRouter, Roo:

1. sanitizes messages using `sanitizeGeminiMessages()`
2. drops tool calls that do not have matching `reasoning_details`
3. drops tool result messages for tool calls that were removed
4. injects a fake `reasoning.encrypted` detail with `data: "skip_thought_signature_validator"` when needed

Purpose:

- avoid Gemini/OpenRouter validation failures when historical tool calls lack the expected reasoning signature structure

This is not reasoning extraction, but it is part of Roo's broader reasoning/tool-call continuity strategy for OpenRouter.

---

## F. Risks and Gaps

## F1. Prompt caching support mismatch

There is a maintenance risk because:

- OpenRouter model capability detection is dynamic
- explicit prompt caching injection is hardcoded

Result:

- supported models can be missed until the allowlist is updated

There is also a design mismatch because OpenRouter supports both implicit and explicit caching styles, while Roo's runtime request mutation currently models only the explicit style clearly.

## F2. OpenRouter does not parse all reasoning fallback shapes

The OpenRouter handler currently ignores:

- `reasoning_content`
- `<think>` blocks embedded in `content`

If OpenRouter forwards a provider response in either of those shapes without normalizing it, Roo will not surface the model's thinking in this path.

## F3. Limited OpenRouter test coverage for fallback extraction

I found OpenRouter tests covering:

- initialization
- caching marker injection
- telemetry/error handling
- tool-call end generation

I did not find OpenRouter-specific tests proving support for:

- `reasoning_content`
- `<think>` extraction from content

That matches the implementation: those fallbacks live elsewhere.

---

## Final Answers

## Does Roo-Code have prompt caching for OpenRouter?

Yes.

- It is implemented in the OpenRouter request builder.
- It injects OpenRouter-style `cache_control: { type: "ephemeral" }` markers.
- It applies automatically for models in the OpenRouter prompt-caching allowlist.
- Capability detection is dynamic, but explicit request enablement is still hardcoded.

For OpenAI GPT models on OpenRouter specifically, OpenRouter docs indicate caching is implicit and automatic, so the right long-term fix is probably not "add GPT models to `OPEN_ROUTER_PROMPT_CACHING_MODELS`", but instead to model implicit caching separately.

## How does Roo-Code handle chunks for OpenRouter?

It uses a custom stream loop that:

- catches stream-level provider errors
- accumulates and consolidates `reasoning_details`
- displays `reasoning.text` and `reasoning.summary`
- suppresses duplicate top-level reasoning if details already covered it
- emits raw partial tool-call chunks
- finalizes tool calls from `finish_reason`
- reports usage including cached token counts and reasoning token counts

Then `Task.ts` accumulates reasoning into a single partial `say: "reasoning"` message, and the webview renders that as a dedicated `Thinking` block.

## How does Roo-Code extract thinking for models that do not send thinking in a reasoning block?

At the project level, Roo supports several fallbacks:

- `reasoning_content`
- top-level `reasoning`
- `<think>...</think>` embedded in streamed text

But for OpenRouter specifically, the current dedicated handler only supports:

- `reasoning_details[]`
- top-level `reasoning`

Only content that the OpenRouter handler classifies as internal `type: "reasoning"` reaches the dedicated `Thinking` block in the UI. If OpenRouter returns thinking only as normal content, Roo will display it as ordinary assistant text.

So the more precise answer is:

- `Roo-Code overall: yes, it has fallback reasoning extraction strategies.`
- `OpenRouter path specifically: no, not all of those fallbacks are implemented there.`

---

## Recommended Follow-up Work

If you want Roo-Code's OpenRouter support to be more complete, the highest-value improvements would be:

1. make OpenRouter prompt caching runtime behavior derive from model capability metadata instead of a static allowlist
2. distinguish OpenRouter implicit caching families from explicit-breakpoint families
3. add `reasoning_content` fallback handling to `src/api/providers/openrouter.ts`
4. optionally add `<think>` tag extraction in the OpenRouter stream path for providers that tunnel reasoning inline
5. add provider tests covering those fallback reasoning formats through OpenRouter
