# dsh-codex-migrate

<div align="center">
  <a href="https://github.com/polarskicpl/dsh-codex-migrate"><img src="https://raw.githubusercontent.com/polarskicpl/dsh-codex-migrate/main/images/banner.webp" alt="dsh-codex-migrate banner" width="520"></a>
  <p><strong>Predictable one-way structured migration between Codex and DeepSeek Harness</strong></p>
  <p>English · <a href="./README.zh.md">中文</a></p>
</div>

Version 2.0 turns the plugin into a two-sided migration bridge. Import Codex tasks into DSH, or move one DSH conversation—or every active conversation in a project—into Codex. Every action is an explicit one-time import; the source conversation is never modified later by background synchronization.

## What's new in v2.0

- **Two-way one-shot imports:** Codex → DSH and DSH → Codex both convert history into the target's structured conversation format instead of flattening everything into plain text.
- **Continue in Codex:** a native Codex action below DSH assistant replies imports the current conversation and opens the new Codex task.
- **Continue in DSH:** the bundled MCP server and `continue-in-dsh` Skill let a Codex user say “Continue in DSH” to import and open the current task in DSH.
- **Batch migration by project:** import every unarchived conversation in a DSH project in one operation while preserving the original workspace path.
- **Project-less Codex tasks:** conversations without a Codex project are imported into the canonical `(no project)` / `codex-unprojected` workspace.
- **MCP memory Beta:** `remember_memory`, `search_memory`, and `forget_memory` provide local persistent memories with global, project, and conversation scopes.
- **Three memory sources:** independently import Codex Markdown memory, bridge MCP memory, and Memory Skill storage.
- **Faster inventory refreshes:** an incremental cache reparses only new or changed files and isolates corrupted sessions.
- **Refined UI:** simplified cards and lists, fixed live language switching, and consistent actions, badges, spacing, and dark/light styling.

## Entry points

The Codex icon appears beside DSH's native copy and feedback actions:

<div align="center">
  <img src="https://raw.githubusercontent.com/polarskicpl/dsh-codex-migrate/main/images/continue-in-codex-action.png" alt="Continue in Codex action in DSH" width="300">
</div>

- Select the **Codex icon** to import one DSH conversation and navigate to Codex.
- Open **Settings → Codex Migration → Batch Migration by Project** to import every unarchived conversation in a project.
- Say **“Continue in DSH”** in Codex to import the current Codex task and navigate to DSH.

> Version 2.0 intentionally does not provide shared conversations, background bidirectional sync, conflict merging, or a Codex inline monitor. Each import is inspectable, repeatable, and cannot silently rewrite the same history on both sides.

## Installation: configure both sides

The complete experience has two local components:

| Component | Installed in | Purpose |
| --- | --- | --- |
| `dsh-codex-migrate` | DSH | Reads, converts, and creates DSH/Codex conversations; hosts the loopback-only handoff service |
| `dsh-codex-bridge` MCP + Skill | Codex | Provides “Continue in DSH,” MCP memory tools, and the trigger workflow |

The DSH plugin alone supports settings-page imports and DSH → Codex actions. Install the Codex companion as well to start imports from Codex or use MCP memory.

### Requirements

- A working DeepSeek Harness installation.
- Codex desktop, Codex CLI, or the Codex IDE extension.
- `node` available in the terminal; Node.js 18 or newer is recommended.
- Commands below use the DSH `web` profile. Replace `web` if you use another profile.

### Step 1: install the DSH plugin

First installation:

```bash
dsh plugin --profile web add dsh-codex-migrate
```

Upgrade from an earlier version:

```bash
dsh plugin --profile web update dsh-codex-migrate
```

Restart DSH, then open **Settings → Codex Migration**. You should see **Imported Conversations**, **Batch Migration by Project**, and **Memory Import**.

### Step 2: get the Codex companion

The MCP server and Skill are bundled in this repository, so keep the cloned directory available locally:

```bash
git clone https://github.com/polarskicpl/dsh-codex-migrate.git
cd dsh-codex-migrate
```

If you already cloned the repository, update it with `git pull`.

### Step 3: register the MCP server in Codex

Windows PowerShell:

```powershell
$bridge = (Resolve-Path ".\codex\dsh-codex-bridge\mcp\server.mjs").Path
codex mcp add dshCodexBridge -- node $bridge --stdio
```

macOS / Linux:

```bash
bridge="$(pwd)/codex/dsh-codex-bridge/mcp/server.mjs"
codex mcp add dshCodexBridge -- node "$bridge" --stdio
```

If the same MCP name is already registered with an old path, run this first and then repeat the add command:

```bash
codex mcp remove dshCodexBridge
```

Verify the registration:

```bash
codex mcp list
```

Codex also supports direct `~/.codex/config.toml` configuration, but the CLI avoids path and TOML escaping mistakes. See the official [Codex MCP documentation](https://developers.openai.com/codex/extend/mcp).

### Step 4: install the `continue-in-dsh` Skill

Windows PowerShell:

```powershell
$skills = Join-Path $HOME ".agents\skills"
New-Item -ItemType Directory -Force -Path $skills | Out-Null
Copy-Item -Recurse -Force ".\codex\dsh-codex-bridge\skills\continue-in-dsh" $skills
```

macOS / Linux:

```bash
mkdir -p ~/.agents/skills
cp -R ./codex/dsh-codex-bridge/skills/continue-in-dsh ~/.agents/skills/
```

Codex discovers user skills in `~/.agents/skills`. Restart Codex if an updated skill does not appear immediately. See the official [Codex Skill documentation](https://developers.openai.com/codex/build-skills).

### Step 5: restart and verify

1. Start DSH with the migration plugin enabled.
2. Restart Codex and confirm that `dshCodexBridge` is connected in `/mcp`.
3. Confirm that `continue-in-dsh` appears in `/skills`.
4. Create a test Codex task and enter: `Continue in DSH`.
5. DSH should open the imported conversation. The Agent confirms with: `已同步对话到 DSH。`

The MCP server exposes four tools:

| Tool | Purpose |
| --- | --- |
| `continue_in_dsh` | Import the current Codex task once and open DSH |
| `remember_memory` | Save a local persistent memory |
| `search_memory` | Search memories in one scope |
| `forget_memory` | Delete a memory by ID |

### Quick MCP memory Beta test

1. In one Codex task, ask: `Use DSH MCP to remember that my test code is ocean-blue-728.`
2. Open another Codex task and ask: `Search DSH MCP memory and tell me my test code.`
3. After it returns `ocean-blue-728`, ask it to forget that memory.

Memories are stored locally at `~/.codex/dsh-codex-bridge/memory.jsonl`. They are not uploaded by this plugin and do not re-enable shared conversations.

## Migrated content

| Content | Codex → DSH | DSH → Codex |
| --- | :---: | :---: |
| User and assistant messages | ✓ | ✓ |
| Tool calls and tool results | ✓ | ✓ |
| Latest regenerated assistant reply | ✓ | ✓ |
| One conversation | ✓ | ✓ |
| Project-less conversations | ✓ | — |
| Batch import by project | ✓ | ✓ |
| `AGENTS.md` and project text files | Optional | — |
| Codex / MCP / Memory Skill memories | Optional | — |

DSH → Codex uses Codex's supported external-agent session import path. Every task in a project batch receives the same original working directory, while Codex remains responsible for sidebar organization.

## Loading performance

The first refresh scans existing Codex sessions. Later refreshes reuse a `size + mtime + hash` incremental cache and parse only new or changed JSONL files. Removed files are dropped from the cache and corrupted files are isolated.

The cache lives under `inventory/` in the migration output directory. Removing it only causes one full rebuild; it does not delete source conversations.

## Key configuration

| Key | Default | Meaning |
| --- | --- | --- |
| `codexDir` | `''` | Codex data directory; empty auto-detects `~/.codex` |
| `outputDir` | `''` | Migration output; empty uses `<DSH_HOME>/codex-sync` |
| `language` | `en` | `en`, `zh`, or `auto` to follow the UI locale |
| `sessionMode` | `new` | `all`, `new`, or `selected` |
| `projectMode` | `all` | `all` or `selected` |
| `includeMemories` | `true` | Import Codex Markdown memory |
| `includeMcpMemories` | `true` | Import bridge MCP persistent memory (Beta) |
| `includeMemorySkill` | `true` | Import Memory Skill storage |
| `importAsDshSessions` | `true` | Create native DSH sidebar conversations |
| `bridgeEnabled` | `true` | Enable the loopback-only one-shot handoff service |

## Security boundary

- The DSH handoff service binds only to `127.0.0.1`.
- Mutations require a generated installation token; the token is never stored in this repository.
- Disabling the DSH plugin also stops the handoff service.
- MCP memory stays local and does not automatically send raw project files or complete conversations to third-party services.
- The plugin writes only to the configured `outputDir`, DSH session storage, and the local MCP memory file.

## Development and release checks

```bash
npm run build
npm test
npm run test:bridge
npm pack --dry-run
```

See [CHANGELOG.md](./CHANGELOG.md) for release history.

MIT
