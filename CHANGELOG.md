# Changelog

## Unreleased

### Fixed

- **Codex → DSH imports on DSH 0.1.5-rc.2.** The import used the flat session-persistence seam (`persistence.create(header)` + `persistence.append(id, events)`), which rc.2 replaced with per-session handles (`create(header) → SessionHandle`, then `handle.append/flush/close`). Because the flat method is what the guard checked, every import was skipped — and reported as `sessionPersistence 服务不可用`, which pointed at the service instead of the API. Both seams are now supported, so one build works on either harness.
- **Imported sessions failed to open.** rc.2 stores each settled assistant message together with the chunk `stream` that produced it and rejects a log whose `assistant/message` lacks it (`... is corrupt: seed assistant/message at index N has invalid settlement fields`). The emitted events now embed a stream rebuilt from the settled content blocks.
- **Header format version.** The handle-based API writes headers in the current log format and refuses a version-less header; the header is now stamped with the installed `SESSION_FORMAT_VERSION`.
- **Merged thread order used the file creation stamp.** Rollout files are merged in file-name order, but a file keeps growing after it is created, so the newest exchange can sit in a file that sorts before newer-named ones — the tail of the imported conversation was then older than the thread's real latest turns. The merge now orders files by their last record timestamp.
- **Long threads imported their OLDEST turns.** `maxDshTurns` counts forward from the first turn, so a month-long thread never reached the recent work. The new `keepLatestTurns` option keeps the newest N turns instead (`0` keeps the previous behaviour).

### Performance

- Rollout files larger than 48 MB are read as a head window plus the newest tail instead of whole, and the inventory indexer does the same. A thread holding several hundred MB in one JSONL file used to abort the harness process with `FATAL ERROR: Reached heap limit` during a sync.

## 2.0.0 — 2026-08-28

Version 2.0 replaces the experimental shared-conversation architecture with explicit, predictable one-way structured imports. It also introduces the Codex companion MCP/Skill package, local MCP memory, native DSH → Codex actions, project batches, and a faster settings experience.

### Added

- Added one-shot structured migration in both directions:
  - Codex → DSH converts user messages, assistant replies, tool calls, and tool results into native DSH events.
  - DSH → Codex converts visible DSH history into Codex's supported external-agent session format.
- Added a native Codex action below every DSH assistant reply to import that conversation and open the resulting Codex task.
- Added **Batch Migration by Project / 按照项目批量迁移** for importing every unarchived DSH conversation in one native Codex batch while preserving the original workspace path.
- Added support for Codex conversations without a project through the canonical `(no project)` key and `codex-unprojected` DSH workspace.
- Added the bundled `dsh-codex-bridge` Codex MCP server and `continue-in-dsh` Skill.
- Added `continue_in_dsh`, which imports the current Codex task, opens DSH, and confirms with `已同步对话到 DSH。`.
- Added local **MCP Memory Beta** tools:
  - `remember_memory`
  - `search_memory`
  - `forget_memory`
- Added global, project, and conversation scopes for MCP memory, stored locally as an append-only JSONL journal.
- Added independent import switches for Codex Markdown memory, bridge MCP memory, and Memory Skill storage.
- Added an imported-conversation list in settings and direct navigation to imported counterparts.
- Added complete Windows PowerShell and macOS/Linux installation instructions for the DSH plugin, Codex MCP, and Skill.

### Changed

- Redesigned the Codex Migration settings page with cleaner cards, compact lists, native colors, rounded controls, and consistent dark/light styling.
- Fixed language switching so the active settings page updates immediately.
- Renamed the whole-project action to **Batch Migration by Project / 按照项目批量迁移** to match its actual behavior.
- Marked bridge MCP memory as **Beta** in the settings UI and documentation.
- Preserved only the latest assistant reply when a source turn was regenerated, matching the source conversation's visible state.
- Preserved native tool-call and tool-result relationships instead of flattening them into plain text.
- Excluded archived DSH sessions from project batches and excluded hidden reasoning/runtime snapshots from visible Codex imports.
- Left Codex sidebar organization to Codex; project batches share the original working directory but do not promise a synthetic sidebar project.

### Performance

- Added an incremental inventory cache keyed by file size, modification time, and content hash.
- Reuses unchanged parsed sessions and reparses only new or changed JSONL files on refresh.
- Removes deleted sessions from the cache and isolates corrupted files without discarding valid inventory.
- Avoids eagerly loading the full conversation inventory when the settings page opens.
- Replaced the repository banner with a smaller WebP asset.

### Security

- The handoff bridge binds only to `127.0.0.1`.
- Mutating bridge calls require a generated installation token.
- Request bodies are size-limited and unknown bridge methods are rejected.
- Disabling the DSH plugin stops the companion handoff service.
- MCP memories remain local by default.

### Removed

- Removed shared conversations and continuous bidirectional synchronization from the product surface.
- Removed writer leases, heartbeat ownership, offline message replay, conflict selection, and automatic cross-side archive propagation.
- Removed the Codex inline monitor/status panel and UI injection experiments.
- Removed the promise to create or group tasks under a synthetic Codex sidebar project.

### Upgrading from 0.1.x

1. Update the DSH plugin and restart DSH.
2. Clone or update this repository locally.
3. Register `codex/dsh-codex-bridge/mcp/server.mjs` with `codex mcp add`.
4. Copy `codex/dsh-codex-bridge/skills/continue-in-dsh` to `~/.agents/skills/`.
5. Restart Codex and verify the server with `/mcp` and the Skill with `/skills`.

Existing one-way migration output remains usable. Experimental shared-state records are not resumed by v2.0.

## 0.1.3 — 2026-08-15

- Added npm/GitHub package links to the installation section.
- Centered and optimized the README banner.
- Kept the original Codex → DSH conversation, MCP configuration, memory, `AGENTS.md`, and optional project-file migration workflow.
