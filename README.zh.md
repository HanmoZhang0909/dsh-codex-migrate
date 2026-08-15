# dsh-codex-migrate

<div align="center">
  <img src="https://raw.githubusercontent.com/polarskicpl/dsh-codex-migrate/main/images/banner.png" alt="dsh-codex-migrate banner" width="520">
</div>

把 [Codex CLI](https://github.com/openai/codex) 的历史迁移进
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH):

- **对话 → 真正的 DSH 会话**:用户轮次、助手轮次与工具调用按 DSH 原生事件格式
  转换(工具卡片默认折叠),按项目挂载到对应工作区,侧边栏直接可见、可续聊。
- **MCP 服务器 → 注册行**:`config.toml` 的 `[mcp_servers.*]` 变成
  `@deepseek-ai/dsh-mcp-client` cordis 行,并生成一段可直接复制给任意 agent 的
  **注册提示词**,让 agent 帮你完成注册。
- **记忆与 AGENTS.md**:复制到输出目录。
- **项目文件(可选)**:按项目复制文本文件。

内置中英双语(界面跟随 DSH 语言;生成产物跟随 `language` 配置)。

## 安装

```bash
dsh plugin --profile web add dsh-codex-migrate
```

(或手动把 `cordis.patch.yml` 里的行合并进你的 profile patch),然后重启 DSH。
设置面板位于 **设置 → Codex 迁移**。

包发布在 npm:[dsh-codex-migrate](https://www.npmjs.com/package/dsh-codex-migrate)
(`dsh plugin add` 按包名从 npm registry 拉取;源码见
[GitHub 仓库](https://github.com/polarskicpl/dsh-codex-migrate))。

## 配置

| 键 | 默认 | 含义 |
| --- | --- | --- |
| `codexDir` | `''` | Codex 数据目录;留空 = 自动检测(`~/.codex`) |
| `outputDir` | `''` | 产物目录;留空 = `<DSH_HOME>/codex-sync` |
| `language` | `en` | 生成产物的语言:`en` \| `zh` \| `auto`(跟随界面语言) |
| `sessionMode` | `new` | `all` \| `new` \| `selected` |
| `projectMode` | `all` | `all` \| `selected` |
| `includeSubagentSessions` | `false` | 子智能体线程默认隐藏 |
| `importAsDshSessions` | `true` | 生成真正的 DSH 会话(取消则只出 Markdown) |
| … | | 频率、上限、MCP/记忆开关等,见 `cordis.patch.yml` |

## 生成产物(`outputDir`)

```
codex-sync/
├── config.json / state.json / diagnostics.json
├── index.md                     # 会话索引
├── sessions/*.md                # 每个会话的 Markdown
├── projects/                    # 可选的项目文件副本
├── memories/ , AGENTS.md
└── mcp/
    ├── cordis-mcp-rows.yml      # 可直接合并的 insert 块
    ├── report.md
    └── register-prompt.md       # 发给任意 agent 即可完成注册
```

## 安全边界

这是一个**宿主插件**:运行在 DSH 进程中,没有会话级沙箱。它**只写
`outputDir` 内部、只读 Codex 目录**。注册迁移过来的 MCP 之前请先审阅你的
Codex MCP 配置——注册后这些工具对会话内所有 agent(含子代理)可见;SSH 类
服务器建议使用命令白名单(`--whitelist` / `commandWhitelist`)而非黑名单。

## 开发

```bash
npm run build          # 把浏览器面打包成 lib/client.js
```

宿主面是纯 ESM,无需构建;浏览器面把 `src/client/index.js` 包装成 DSH Web 外壳
消费的 `window.__ModuleLoader__.load` 形式(运行时 require 由装载器的模块表解析)。

## 许可证

MIT
