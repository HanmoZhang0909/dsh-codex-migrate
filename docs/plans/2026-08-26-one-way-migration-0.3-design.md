# One-way Migration 0.3 Design

## Product boundary

Version 0.3 removes shared-conversation behavior from the product. There is no persistent active side, cloud state, lease, conflict chooser, automatic future-conversation registration, routed follow-up message, live status card, or bidirectional chat synchronization. Existing conversion code remains internal because it is the tested implementation for explicit imports, but it no longer creates a shared relationship between the two conversations.

Codex → DSH is an explicit one-shot action exposed through the `continue-in-dsh` skill. It imports the current Codex task into DSH, requests DSH to open the resulting conversation, and returns one canonical user-facing sentence: `已同步对话到 DSH。` DSH → Codex remains available as a one-shot action below a DSH assistant message. It imports that conversation in Codex's supported external-agent format and opens the created Codex task. Repeating either action may reuse an already-created target to avoid accidental duplicates, but no changes propagate afterward unless the user explicitly imports again.

The settings card formerly titled “Shared Conversations” becomes “Imported Conversations”. It is derived from the ordinary migration inventory and import state, not bridge status. Each row shows title, source project or “No project”, date, source kind, and whether a DSH session was created. Shared-memory cadence and provider controls are removed.

## Memory, projects, and UI

Memory import is selectable and strictly source-to-target. Supported sources are: Codex built-in Markdown memory (`MEMORY.md`, `memory.md`, and `.codex/memories/*.md`), the companion MCP's persisted memory JSONL, and the installed Memory skill's `~/memory/**/*.md` tree. Files remain namespaced by source under the migration output so same-named memories cannot overwrite one another. A generated index records source, relative path, and import time. Compatible MCP providers remain readable adapters, but are never used to establish a shared live memory channel.

Codex conversations without a project use one canonical `(no project)` key throughout inventory filtering and migration. When imported as DSH sessions they are attached to a dedicated `codex-unprojected` workspace under the migration output rather than being dropped by the selected-project filter or attached to the DSH data directory.

DSH project transfer imports every non-archived session belonging to one authoritative DSH workspace into Codex, preserving each conversation as a separate Codex task and returning all task URLs. The current DSH release exposes no additive slot for third-party items inside the workspace ellipsis menu. Version 0.3 therefore places the action in the plugin's DSH-project list and, where available, the current-session header. It deliberately avoids DOM mutation because that previously caused positioning and stability failures. If DSH later adds a workspace-row menu slot, the same action can be registered there without changing host logic.

## Verification

Tests cover: no monitor metadata or widget resource; canonical skill reply; no shared UI strings or cloud controls; all three memory-source imports; no-project selection and fallback workspace; single DSH conversation import; authoritative whole-project import excluding archived sessions; Codex external-agent tool-call/result preservation; build output and DSH client contract. A local DSH restart and health check complete deployment verification.
