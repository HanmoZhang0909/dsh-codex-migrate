# Bidirectional Conversation Bridge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship dsh-codex-migrate 0.2.0 with reliable bidirectional conversation handoff, single-writer coordination, pluggable MCP memory, DSH/Codex status UI, and faster migration inventory.

**Architecture:** Keep the DSH host plugin as the local coordinator. Persist canonical bridge events in append-only JSONL and materialize a recoverable state index. Codex and DSH adapters translate native conversations to canonical turns, while capability-based memory adapters reuse an existing MCP provider or fall back to the companion MCP's embedded JSONL provider.

**Tech Stack:** Node.js ESM, DSH Cordis services, React 18 host UI, MCP stdio/Apps resource, JSON/JSONL, `node:test`, Playwright visual verification.

---

## Working rules

- Use `@Code` for implementation and verification.
- Use `@frontend-design` before changing the DSH settings UI or Codex status card.
- Do not stage or overwrite unrelated user changes in the existing dirty worktree.
- Before implementation, create a reviewed baseline commit or a dedicated worktree from a reviewed branch.
- Every state-changing function must have a failing test first.
- Keep `src/client/index.js` and generated `lib/client.js` synchronized through `npm run build`.

### Task 0: Establish the v0.2 baseline

**Files:**
- Review: `package.json`
- Review: `lib/logic.js`
- Review: `lib/bridge-server.js`
- Review: `codex/dsh-codex-bridge/**`
- Review: `src/client/index.js`
- Verify: `scripts/test-bridge.mjs`

**Step 1: Record the current dirty state**

Run: `git status --short` and `git diff --stat`  
Expected: the existing migration and bridge prototype changes are visible; nothing is discarded.

**Step 2: Run the current baseline tests**

Run: `npm run test:bridge`  
Expected: `bridge tests passed`.

Run: `npm run build`  
Expected: client bundle completes without unresolved runtime imports.

**Step 3: Review prototype ownership**

Separate v0.2 prototype files from unrelated user edits. Do not use reset, checkout, or recursive deletion.

**Step 4: Create the implementation worktree/checkpoint**

Only after review, create a branch/worktree or a scoped baseline commit. Do not automatically commit unrelated files.

### Task 1: Define the canonical protocol

**Files:**
- Create: `lib/bridge/protocol.js`
- Create: `test/bridge-protocol.test.mjs`
- Modify: `package.json`

**Step 1: Write failing protocol tests**

Cover stable event IDs, canonical turn normalization, base revisions, status transitions, archive policies, sync policies, and schema rejection.

```js
test('rejects a second writer while a lease is active', () => {
  const state = createConversation({ activeSide: 'dsh', lease: liveLease('dsh') })
  assert.throws(() => reduceEvent(state, acquireLeaseEvent('codex')), /LEASE_HELD/)
})
```

**Step 2: Run the test and verify failure**

Run: `node --test test/bridge-protocol.test.mjs`  
Expected: FAIL because `lib/bridge/protocol.js` does not exist.

**Step 3: Implement the protocol module**

Export frozen enums and pure functions:

```js
export const BRIDGE_STATUS = Object.freeze({
  READY: 'ready', PENDING: 'pending', RUNNING: 'running',
  PAUSED: 'paused', ERROR: 'error', CONFLICT: 'conflict',
})

export function reduceBridgeEvent(state, event) { /* pure reducer */ }
export function normalizeCodexTurn(input) { /* canonical turn */ }
export function normalizeDshTurn(input) { /* canonical turn */ }
```

**Step 4: Run tests**

Expected: all protocol tests PASS.

**Step 5: Commit**

Commit message: `feat: define shared conversation protocol`

### Task 2: Add the durable event journal and materialized store

**Files:**
- Create: `lib/bridge/event-store.js`
- Create: `test/bridge-event-store.test.mjs`
- Modify: `lib/logic.js`

**Step 1: Write failing store tests**

Test append-before-materialize ordering, atomic temp rename, replay, duplicate event IDs, truncated final JSONL record, and snapshot compaction.

**Step 2: Verify failure**

Run: `node --test test/bridge-event-store.test.mjs`  
Expected: FAIL because the store is not implemented.

**Step 3: Implement the store**

Use these files under `<outputDir>/bridge/`:

```text
events.jsonl
state.json
snapshots/<revision>.json
pending.jsonl
```

Write each event to `events.jsonl`, flush it, then atomically replace `state.json`. Replay must ignore already-applied `eventId` values.

**Step 4: Replace direct bridge-state mutations in `lib/logic.js`**

Keep the public methods stable while routing all mutations through the reducer and event store.

**Step 5: Run tests and commit**

Run: `node --test test/bridge-event-store.test.mjs test/bridge-protocol.test.mjs`  
Expected: PASS.

Commit message: `feat: persist bridge state as replayable events`

### Task 3: Implement leases, takeover, branch, archive, and conflict resolution

**Files:**
- Create: `lib/bridge/lease.js`
- Create: `lib/bridge/conflicts.js`
- Create: `test/bridge-lease-conflict.test.mjs`
- Modify: `lib/bridge/protocol.js`
- Modify: `lib/logic.js`

**Step 1: Write failing tests**

Cover heartbeat renewal, lease expiry, explicit takeover, stale token rejection, first-divergence detection, choosing one canonical side, manual archive, automatic archive, and branch opt-in.

**Step 2: Implement lease operations**

```js
export function acquireLease(state, side, now, ttlMs) {}
export function heartbeatLease(state, token, now) {}
export function releaseLease(state, token, now) {}
```

Use monotonic comparisons where available and tolerate small wall-clock skew.

**Step 3: Implement conflict resolution**

Store both divergent tails in the recovery journal, expose only the chosen tail in materialized state, and increment the canonical revision.

**Step 4: Run tests and commit**

Commit message: `feat: enforce single-writer conversation leases`

### Task 4: Build Codex and DSH conversation adapters plus the sync engine

**Files:**
- Create: `lib/bridge/adapters/codex.js`
- Create: `lib/bridge/adapters/dsh.js`
- Create: `lib/bridge/sync-engine.js`
- Create: `test/bridge-adapters.test.mjs`
- Create: `test/bridge-sync-engine.test.mjs`
- Modify: `lib/logic.js`

**Step 1: Add fixture-driven failing tests**

Fixtures must include natural-language turns, tool calls, regenerated assistant replies, archived conversations, project-less conversations, project conversations, and duplicated delivery.

**Step 2: Implement canonical conversion**

Each adapter exposes `readSince(cursor)`, `createCounterpart()`, `appendTurns()`, `archive()`, and `getExecutionState()`.

**Step 3: Implement the two sync policies**

- `task_turn`: flush on task completion or completed user/assistant round.
- `agent_message`: flush after each agent message.

Use canonical turn hashes and idempotency keys to prevent loops.

**Step 4: Run tests and commit**

Commit message: `feat: synchronize canonical turns across codex and dsh`

### Task 5: Implement capability-based memory providers

**Files:**
- Create: `lib/bridge/memory/provider.js`
- Create: `lib/bridge/memory/discovery.js`
- Create: `lib/bridge/memory/embedded-jsonl.js`
- Create: `lib/bridge/memory/agentmemory.js`
- Create: `lib/bridge/memory/mcp-knowledge-graph.js`
- Create: `lib/bridge/memory/neo4j.js`
- Create: `test/bridge-memory.test.mjs`
- Modify: `lib/bridge/sync-engine.js`
- Modify: `codex/dsh-codex-bridge/mcp/server.mjs`

**Step 1: Define and test the provider contract**

```js
export class MemoryProvider {
  async capabilities() {}
  async bootstrap(scope) {}
  async readSince(scope, cursor) {}
  async upsert(scope, memories, expectedRevision) {}
  async remove(scope, ids, expectedRevision) {}
  async subscribe(scope, onUpdate) {}
}
```

Test provider selection order, conversation/project/global scope, initial bootstrap, unchanged no-op, incremental upsert/delete, tombstones, revision conflicts, and offline replay.

**Step 2: Implement discovery**

Prefer user selection, then the source-side active provider, then any compatible registered provider, then embedded JSONL. Match capabilities, not only server names.

**Step 3: Implement the embedded provider**

Store in `<outputDir>/bridge/memory.jsonl`; expose MCP tools/resources from the existing companion server so no second process is required.

**Step 4: Implement adapters**

- AgentMemory: save/search/session tools.
- MCP Knowledge Graph: entities, observations, relations, search, resource updates.
- Neo4j: optional adapter loaded only when its tools are present.

**Step 5: Implement memory commit cadence**

Run bootstrap once. Afterwards, flush only memory mutation events at task/turn boundaries; explicit remember calls flush immediately. Never copy the whole provider on every message.

**Step 6: Run tests and commit**

Commit message: `feat: add pluggable incremental memory sync`

### Task 6: Secure and extend the loopback bridge service

**Files:**
- Modify: `lib/bridge-server.js`
- Modify: `lib/index.js`
- Create: `test/bridge-server.test.mjs`
- Modify: `cordis.patch.yml`

**Step 1: Write failing HTTP/RPC tests**

Test token-required mutations, loopback binding, read-only health, size limits, invalid method rejection, standalone startup, host startup, and graceful disposal.

**Step 2: Add install-token authentication**

Generate a random token once, store it with restrictive permissions, and require it for all state-changing RPC calls. Never print it in normal logs.

**Step 3: Add conversation, lease, conflict, memory, and event methods**

Keep compatibility aliases for the existing prototype methods during 0.2 migration.

**Step 4: Run tests and commit**

Commit message: `feat: secure the local conversation bridge`

### Task 7: Finalize the Codex companion MCP and status card

**Files:**
- Modify: `codex/dsh-codex-bridge/mcp/server.mjs`
- Modify: `codex/dsh-codex-bridge/assets/status.html`
- Modify: `codex/dsh-codex-bridge/skills/continue-in-dsh/SKILL.md`
- Modify: `codex/dsh-codex-bridge/.codex-plugin/plugin.json`
- Modify: `scripts/test-bridge.mjs`
- Create: `scripts/visual-test-bridge-card.mjs`

**Step 1: Add failing MCP contract tests**

Verify auto-registration, stable bridge reuse, send, takeover, app-only status reads, embedded memory tools, unique latest render, and resource metadata.

**Step 2: Implement prompt-driven handoff**

No persistent Continue button or native Codex injection. Keep only `continue_in_dsh`, `send_to_dsh`, `take_over_in_codex`, status reads, and memory provider tools.

**Step 3: Finalize the full-width card**

Show real Todo, two latest status messages, current operation, open/takeover actions, error styling, stale-render hiding, and no black host gap.

**Step 4: Run MCP and visual tests**

Run: `npm run test:bridge`  
Expected: PASS.

Capture running, pending, error, narrow, and extra-host-height states. Review every image before proceeding.

**Step 5: Commit**

Commit message: `feat: finalize codex handoff companion`

### Task 8: Build DSH registration, sidebar status, and continue UI

**Files:**
- Modify: `src/client/index.js`
- Modify: `lib/index.js`
- Modify: `lib/i18n.js`
- Create: `src/client/bridge-model.js`
- Create: `test/client-bridge-model.test.mjs`
- Regenerate: `lib/client.js`

**Step 1: Extract and test a pure UI model**

Test normal/blue/yellow/red icon mapping, project-all auto-membership, selected membership, register-all, selected registration, branch prompt, archive settings, and unshare.

**Step 2: Add DSH message action**

Add a native Codex icon action alongside copy/branch for “在 Codex 继续”. Do not add a fixed top action bar.

**Step 3: Add sidebar cloud states**

Project sharing replaces the folder icon; single-conversation sharing prefixes the conversation icon. Use accessible text and tooltips in addition to color.

**Step 4: Add registration and conflict dialogs**

Counterpart sessions are created immediately. Conflict dialog shows the first differing message and asks which side to keep.

**Step 5: Build and test**

Run: `npm run build` and `node --test test/client-bridge-model.test.mjs`  
Expected: PASS.

**Step 6: Commit**

Commit message: `feat: add dsh shared conversation controls`

### Task 9: Redesign settings, fix language switching, and speed inventory refresh

**Files:**
- Modify: `src/client/index.js`
- Modify: `lib/logic.js`
- Create: `lib/inventory/indexer.js`
- Create: `test/inventory-indexer.test.mjs`
- Modify: `README.md`
- Modify: `README.zh.md`
- Replace: `images/banner.png` or add `images/banner.webp`
- Regenerate: `lib/client.js`

**Step 1: Write failing inventory tests**

Test cold scan, unchanged cache hit, one-file update, deletion, corrupted JSONL isolation, and stable ordering. Record timing without making tests depend on a slow machine.

**Step 2: Implement the incremental index**

Cache path, size, mtime, content hash, project key, session summary, and parse errors. Status polling must never call inventory scanning.

**Step 3: Fix locale state**

Move active UI language into React state. `Auto` subscribes to DSH locale; explicit English/中文 updates translations immediately before save completes.

**Step 4: Redesign settings**

Use compact sections for source, migration, shared conversations, scope, memory, logs, and advanced settings. Keep clear confirmation, but do not label a danger zone; unshare remains ordinary.

**Step 5: Virtualize or batch long lists**

Render only visible or paged project/session rows and preserve selection across pages.

**Step 6: Optimize repository media**

Compress the 1.65 MB banner, reference it with a repository-relative URL, and verify README rendering and direct opening.

**Step 7: Verify and commit**

Run: `npm run build`, inventory tests, and visual settings-page checks in both languages.  
Commit message: `perf: streamline migration settings and inventory`

### Task 10: End-to-end recovery, packaging, and 0.2.0 release readiness

**Files:**
- Create: `scripts/e2e-bidirectional-bridge.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `README.zh.md`
- Create: `CHANGELOG.md`

**Step 1: Add end-to-end scenarios**

Cover single conversation, whole project, selected conversations, future project conversation, task-turn cadence, per-message cadence, branch opt-in/out, takeover, manual/automatic archive, provider reuse, embedded memory, provider outage, DSH outage, duplicate events, restart replay, and conflict choice.

**Step 2: Run the full suite**

Run: `node --test test/*.test.mjs`  
Run: `npm run test:bridge`  
Run: `npm run build`  
Run: `node scripts/e2e-bidirectional-bridge.mjs`  
Expected: all PASS and no unhandled rejection.

**Step 3: Verify package contents**

Run: `npm pack --dry-run`  
Expected: host runtime, Codex companion, assets, patch, READMEs, and types are present; temporary state and test outputs are absent.

**Step 4: Security and failure review**

Verify loopback-only binding, token redaction, path boundaries, payload limits, tombstones, event replay, and absence of raw secrets in generated artifacts.

**Step 5: Bump and document**

Set version to `0.2.0`, document migration from 0.1.x, and add the release notes.

**Step 6: Final release commit**

Commit message: `release: prepare dsh-codex-migrate 0.2.0`

