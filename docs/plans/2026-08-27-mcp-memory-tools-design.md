# MCP Persistent Memory Tools Design

## Decision

Expose the existing local bridge memory store through exactly three MCP tools:
`remember_memory`, `search_memory`, and `forget_memory`. Conversation migration
remains a one-way operation through `continue_in_dsh`; no shared conversation,
inline monitor, background message routing, or bidirectional chat sync is restored.

## Storage and scope

All memory mutations are appended to the existing local JSONL journal at
`~/.codex/dsh-codex-bridge/memory.jsonl`. Tests may override the path with
`DSH_CODEX_BRIDGE_MEMORY_FILE`. Memories support `global`, `project`, and
`conversation` scopes. The default is `global:default`, so ordinary “remember
this” requests work without the model inventing a project or task identifier.

The current materializer continues to export active journal entries to
`memories/mcp/memory.md` during a one-way DSH sync. When the final active memory
is forgotten, the materialized Markdown file is removed so deleted memory is
not left behind as stale context.

## Tool behavior

- `remember_memory` stores a concise fact, preference, or instruction. If no ID
  is supplied, the store derives a deterministic ID from its kind and content.
- `search_memory` performs a case-insensitive search within one scope. An empty
  query lists memories in that scope, capped by a configurable result limit.
- `forget_memory` appends a tombstone for one ID. It is the only destructive
  memory operation and must be invoked only on an explicit user request.

Each tool returns both readable text and structured content. The server
instructions tell the agent when to use each operation while keeping all data
local.

## Verification

The bridge smoke test must confirm that the MCP tool list contains all four
tools, memory can be saved and found, the journal is materialized into DSH, and
forgetting the memory makes it unsearchable and removes stale materialized
output. The existing `continue_in_dsh` fixed reply and no-inline-panel tests
must continue to pass.
