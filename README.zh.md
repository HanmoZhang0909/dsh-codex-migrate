# dsh-codex-migrate

<div align="center">
  <a href="https://github.com/polarskicpl/dsh-codex-migrate"><img src="https://raw.githubusercontent.com/polarskicpl/dsh-codex-migrate/main/images/banner.webp" alt="dsh-codex-migrate banner" width="520"></a>
  <p><strong>在 Codex 与 DeepSeek Harness 之间进行可预测的单向结构化迁移</strong></p>
  <p><a href="./README.md">English</a> · 中文</p>
</div>

v2.0 将插件从“导出工具”升级为双端迁移桥：既可以把 Codex 对话导入 DSH，也可以从 DSH 把单个对话或整个项目的对话批量导入 Codex。每次操作都是明确的一次性迁移，不在后台修改源对话。

## v2.0 新增内容

- **双向单次导入**：Codex → DSH 与 DSH → Codex 都会转换为目标端支持的结构化会话格式，而不是简单拼接纯文本。
- **在 Codex 继续**：DSH 回复下方新增原生 Codex 图标；点击后导入当前对话，并自动打开新建的 Codex 任务。
- **在 DSH 继续**：安装配套 MCP 与 `continue-in-dsh` Skill 后，在 Codex 里说“在 DSH 继续”即可导入当前任务并打开 DSH。
- **按照项目批量迁移**：一次导入某个 DSH 项目内的全部未归档对话，并为每个 Codex 任务沿用原工作区路径。
- **无项目对话支持**：Codex 中没有项目归属的对话也能导入 DSH，统一显示在 `(no project)` / `codex-unprojected` 工作区。
- **MCP 记忆 Beta**：新增 `remember_memory`、`search_memory`、`forget_memory`，支持全局、项目和单对话范围的本地持久记忆。
- **三类记忆导入**：可以分别选择 Codex Markdown 记忆、桥接 MCP 记忆和 Memory Skill 存储。
- **更快的清单刷新**：会话清单使用增量缓存，只重新解析新增或发生变化的文件；损坏文件会被单独隔离。
- **重新设计的设置界面**：简化卡片层级、列表和状态信息，修复语言切换，并统一按钮、徽标与深浅色样式。

## 功能入口

在 DSH 的助手回复下方，Codex 图标与复制、点赞等原生操作位于同一行：

<div align="center">
  <img src="https://raw.githubusercontent.com/polarskicpl/dsh-codex-migrate/main/images/continue-in-codex-action.png" alt="Continue in Codex action in DSH" width="300">
</div>

- 点击 **Codex 图标**：将这一条 DSH 对话导入 Codex 并跳转。
- 打开 **设置 → Codex 迁移 → 按照项目批量迁移**：批量导入项目内全部未归档对话。
- 在 Codex 中说 **“在 DSH 继续”**：将当前 Codex 任务导入 DSH 并跳转。

> v2.0 不提供共享对话、后台双向同步、冲突合并或 Codex 内联监视面板。目标是让每次迁移可检查、可重复、不会在两端静默改写同一段历史。

## 安装：两端都需要配置

完整功能由两个本地组件组成：

| 组件 | 安装位置 | 作用 |
| --- | --- | --- |
| `dsh-codex-migrate` | DSH | 读取、转换和创建 DSH/Codex 会话；提供仅监听本机的一次性交接服务 |
| `dsh-codex-bridge` MCP + Skill | Codex | 提供“在 DSH 继续”、MCP 记忆工具和触发规则 |

只安装 DSH 插件仍可使用设置页导入以及 DSH → Codex 按钮；若要从 Codex 发起迁移或使用 MCP 记忆，必须继续完成 Codex 侧安装。

### 前置要求

- 已安装并可启动 DeepSeek Harness（DSH）。
- 已安装 Codex 桌面端、Codex CLI 或 IDE 扩展。
- `node` 可在终端运行；建议 Node.js 18 或更高版本。
- 以下命令默认使用 DSH 的 `web` profile；如你的 profile 名称不同，请替换 `web`。

### 第 1 步：安装 DSH 插件

首次安装：

```bash
dsh plugin --profile web add dsh-codex-migrate
```

从旧版升级：

```bash
dsh plugin --profile web update dsh-codex-migrate
```

完成后重启 DSH，打开 **设置 → Codex 迁移**。确认能看到 **已导入的对话**、**按照项目批量迁移** 和 **记忆导入**。

### 第 2 步：取得 Codex 配套组件

Codex MCP 与 Skill 位于同一个仓库中，因此需要保留本地仓库目录：

```bash
git clone https://github.com/polarskicpl/dsh-codex-migrate.git
cd dsh-codex-migrate
```

如果你已经克隆了仓库，执行 `git pull` 更新即可。

### 第 3 步：在 Codex 注册 MCP

Windows PowerShell：

```powershell
$bridge = (Resolve-Path ".\codex\dsh-codex-bridge\mcp\server.mjs").Path
codex mcp add dshCodexBridge -- node $bridge --stdio
```

macOS / Linux：

```bash
bridge="$(pwd)/codex/dsh-codex-bridge/mcp/server.mjs"
codex mcp add dshCodexBridge -- node "$bridge" --stdio
```

如果此前已用其他路径注册过同名 MCP，先执行：

```bash
codex mcp remove dshCodexBridge
```

然后重新运行上面的 `add` 命令。可用以下命令确认注册结果：

```bash
codex mcp list
```

Codex 官方也允许直接编辑 `~/.codex/config.toml`；CLI 注册方式更不容易出现路径和 TOML 转义问题。参见 [Codex MCP 文档](https://developers.openai.com/codex/extend/mcp)。

### 第 4 步：安装 `continue-in-dsh` Skill

Windows PowerShell：

```powershell
$skills = Join-Path $HOME ".agents\skills"
New-Item -ItemType Directory -Force -Path $skills | Out-Null
Copy-Item -Recurse -Force ".\codex\dsh-codex-bridge\skills\continue-in-dsh" $skills
```

macOS / Linux：

```bash
mkdir -p ~/.agents/skills
cp -R ./codex/dsh-codex-bridge/skills/continue-in-dsh ~/.agents/skills/
```

Codex 会从 `~/.agents/skills` 读取用户级 Skill。若更新后没有立即出现，重启 Codex。参见 [Codex Skill 文档](https://developers.openai.com/codex/build-skills)。

### 第 5 步：重启并验证

1. 启动 DSH，并保持迁移插件启用。
2. 重启 Codex，在 `/mcp` 中确认 `dshCodexBridge` 已连接。
3. 在 `/skills` 中确认可以看到 `continue-in-dsh`。
4. 新建一个 Codex 测试任务，输入：`在 DSH 继续`。
5. 成功时会打开对应的 DSH 对话，Agent 固定回复：`已同步对话到 DSH。`

MCP 应暴露四个工具：

| 工具 | 作用 |
| --- | --- |
| `continue_in_dsh` | 一次性导入当前 Codex 任务并打开 DSH |
| `remember_memory` | 保存本地持久记忆 |
| `search_memory` | 检索指定范围内的记忆 |
| `forget_memory` | 按 ID 删除记忆 |

### 快速测试 MCP 记忆 Beta

1. 在一个 Codex 任务中输入：`请通过 DSH MCP 记住：我的测试代号是海蓝-728。`
2. 新建另一个 Codex 任务，输入：`请搜索 DSH MCP 记忆，告诉我测试代号。`
3. 确认回答为 `海蓝-728` 后，输入：`请从 DSH MCP 记忆中删除海蓝-728。`

记忆默认保存在 `~/.codex/dsh-codex-bridge/memory.jsonl`，不会上传到远端，也不会恢复已经废弃的共享会话功能。

## 迁移内容

| 内容 | Codex → DSH | DSH → Codex |
| --- | :---: | :---: |
| 用户与助手消息 | ✓ | ✓ |
| 工具调用与工具结果 | ✓ | ✓ |
| 最新一次重新生成的回复 | ✓ | ✓ |
| 单个对话 | ✓ | ✓ |
| 无项目对话 | ✓ | — |
| 按项目批量导入 | ✓ | ✓ |
| `AGENTS.md` 与项目文本 | 可选 | — |
| Codex / MCP / Memory Skill 记忆 | 可选 | — |

DSH → Codex 使用 Codex 支持的外部 Agent 会话导入路径。批量迁移会为每个任务使用同一个原始工作区路径，但 Codex 侧栏如何归类由 Codex 自身决定。

## 加载速度优化

首次刷新需要扫描现有 Codex 会话。之后的刷新会复用 `size + mtime + hash` 增量缓存，只解析新增或变化的 JSONL 文件，并从缓存移除已经删除的文件，因此大型会话目录的重复刷新更快、更稳定。

缓存位于迁移输出目录下的 `inventory/`，删除缓存只会触发一次完整重建，不会删除原始对话。

## 主要配置

| 键 | 默认 | 含义 |
| --- | --- | --- |
| `codexDir` | `''` | Codex 数据目录；留空自动检测 `~/.codex` |
| `outputDir` | `''` | 迁移产物目录；留空使用 `<DSH_HOME>/codex-sync` |
| `language` | `en` | `en`、`zh` 或跟随界面的 `auto` |
| `sessionMode` | `new` | `all`、`new` 或 `selected` |
| `projectMode` | `all` | `all` 或 `selected` |
| `includeMemories` | `true` | 导入 Codex Markdown 记忆 |
| `includeMcpMemories` | `true` | 导入桥接 MCP 持久记忆（Beta） |
| `includeMemorySkill` | `true` | 导入 Memory Skill 存储 |
| `importAsDshSessions` | `true` | 创建可在 DSH 侧栏打开的原生会话 |
| `bridgeEnabled` | `true` | 启用仅监听 `127.0.0.1` 的一次性交接服务 |

## 安全边界

- DSH 交接服务仅监听 `127.0.0.1`。
- 写操作需要安装令牌；令牌不会写入 README 或仓库。
- 关闭 DSH 插件会同时关闭交接服务。
- MCP 记忆保存在本机；不会自动发送原始项目文件或完整对话到第三方服务。
- 插件只写配置的 `outputDir`、DSH 会话存储以及本地 MCP 记忆文件。

## 开发与发布检查

```bash
npm run build
npm test
npm run test:bridge
npm pack --dry-run
```

更新历史见 [CHANGELOG.md](./CHANGELOG.md)。

MIT
