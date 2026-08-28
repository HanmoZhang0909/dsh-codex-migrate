# DSH Project to Codex Import Design

## Problem

The project action previously looped over DSH conversations and performed one
Codex external-agent import per conversation. Although each session may contain
a working directory, the loop derived it again from session metadata instead
of using the authoritative DSH workspace record. This could fragment one
project migration into several unrelated operations.

## Decision

A whole-project migration is one native Codex import operation. The DSH
workspace absolute path is the canonical working directory. The importer writes
all prepared external-agent session files below one temporary Claude project
directory, asks Codex to detect all of them for the original workspace path,
and submits one `SESSIONS` migration item containing every selected session.

The bridge does not create, register, or assign a Codex sidebar project. That
surface is owned by Codex and is not a reliable part of the external-agent
import contract. Every task receives the same `cwd` and keeps its own title and
structured conversation/tool history.

## Compatibility and errors

Single-conversation import is unchanged. A custom Codex adapter that does not
implement the new project batch method falls back to individual imports, but
the authoritative project path is explicitly supplied to every call.

Archived DSH sessions remain excluded. If the workspace has no usable path,
the project import fails instead of silently assigning conversations to the
DSH profile home or an unrelated project. A native batch failure is reported
for the project without creating an intentionally fragmented fallback import.

## Verification

Tests assert that the project entry performs one batch adapter call, passes the
original DSH workspace path, excludes archived sessions, preserves both titles
and transcripts, and maps all returned Codex task IDs. A real isolated Codex
app-server probe additionally verifies that every task has the same `cwd` and
does not depend on a project ID. The single-conversation test surface and the
full migration/MCP suites must continue to pass.
