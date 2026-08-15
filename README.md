# dsh-codex-migrate

<!-- 宣传图占位:建 GitHub 仓库后把图放入 images/banner.png,并在下一行解除注释、把 URL 换成你的仓库 raw 地址:
![dsh-codex-migrate banner](https://raw.githubusercontent.com/<your-account>/dsh-codex-migrate/main/images/banner.png)
-->

Migrate your [Codex CLI](https://github.com/openai/codex) history into
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH):

- **Conversations → real DSH sessions**: user turns, assistant turns and tool
  calls are converted into native DSH event format (tool cards collapse by
  default), mounted into per-project workspaces, and appear in the sidebar.
- **MCP servers → registration rows**: `config.toml` `[mcp_servers.*]` entries
  become `@deepseek-ai/dsh-mcp-client` cordis rows, plus a copy-paste
  **registration prompt** you can hand to any agent to complete the
  registration for you.
- **Memories & AGENTS.md**: copied into the output directory.
- **Project files (optional)**: text files copied per project.

English and Chinese are both built in (UI follows the DSH locale; generated
artifacts follow the `language` config).

## Install

```bash
dsh plugin --profile web add dsh-codex-migrate
```

(or add the row from `cordis.patch.yml` to your profile patch manually), then
restart DSH. The settings panel appears under **Settings → Codex Migration**.

## Configure

| Key | Default | Meaning |
| --- | --- | --- |
| `codexDir` | `''` | Codex data dir; empty = auto-detect (`~/.codex`) |
| `outputDir` | `''` | Where artifacts live; empty = `<DSH_HOME>/codex-sync` |
| `language` | `en` | `en` \| `zh` \| `auto` (follow UI locale) for generated artifacts |
| `sessionMode` | `new` | `all` \| `new` \| `selected` |
| `projectMode` | `all` | `all` \| `selected` |
| `includeSubagentSessions` | `false` | Subagent threads are hidden by default |
| `importAsDshSessions` | `true` | Create real DSH sessions (uncheck for Markdown-only) |
| … | | frequency, caps, MCP/memories toggles — see `cordis.patch.yml` |

## Generated artifacts (`outputDir`)

```
codex-sync/
├── config.json / state.json / diagnostics.json
├── index.md                     # session index
├── sessions/*.md                # per-session Markdown
├── projects/                    # optional project file copies
├── memories/ , AGENTS.md
└── mcp/
    ├── cordis-mcp-rows.yml      # DSH-ready insert block
    ├── report.md
    └── register-prompt.md       # paste to any agent to finish registration
```

## Security boundary

This is a **host plugin**: it runs in the DSH process without a per-session
sandbox. It only **writes inside `outputDir`** and only **reads the Codex
directory**. Review your Codex MCP config before registering migrated MCP
servers — after registration those tools are visible to every agent in a
session, including subagents. For SSH-style servers prefer a command
whitelist (`--whitelist` / `commandWhitelist`) over a blacklist.

## Development

```bash
npm run build          # bundles the client half into lib/client.js
```

The host half is plain ESM and needs no build step. The client half wraps
`src/client/index.js` into the `window.__ModuleLoader__.load` form consumed by
the DSH web shell (runtime requires are resolved by the loader's module table).

## License

MIT
