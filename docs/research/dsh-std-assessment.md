# dsh-std 对 dsh-codex-migrate 的适用性评估

调研日期：2026-08-28

## 结论

`Yan-Zero/dsh-std` 值得采纳，但当前适合“分层、双轨、可回退”地采用，不适合把 `dsh-codex-migrate` 一次性重写为纯标准插件，也不应立即宣称已通过社区标准认证。

它不会让为 DSH 0.1 开发的传统插件自动失效。社区 RFC 明确要求迁移期保留官方现有的 `dsh.bundle`、Cordis 和非标准插件加载路径。`dsh-std` 是该 RFC 的探索/参考实现之一；仓库有真实 npm 包、协议实现、验证器、测试和 DSH Adapter，不只是文档，但仓库和各提案仍明确标为 early draft / 草案。

对本插件最合适的策略：保留现有原生 DSH 入口作为生产路径，同时先采纳静态 manifest、能力声明、Adapter 边界、生命周期归属和 CI 预检；待 Session、Workspace、跨端 UI 与一致性套件稳定后，再逐项切换运行时能力。

## 它究竟是什么

`@dsh-std/core` 是领域无关的元协议：以 `apiVersion + kind` 标识能力，参与者声明 `requires` / `supports`，再由协商器形成兼容性报告。Command、Tool、Model、Session、Workspace、Presentation、UI 等是独立协议，可以各自演进。

仓库同时提供：

- `@dsh-std/manifest`：Community v0.15 `dsh-plugin.json` 的对象模型、草案 schema 和验证器；
- `@dsh-std/sdk`、lifecycle、composition、connection：分面激活、作用域清理、发布屏障和连接调用；
- 一组领域协议包；
- `@dsh-std/adapter-dsh`：把标准组件装入 DSH，并隔离 Cordis、Typert、Agent、原生 slot 等产品内部 API；
- 19 个测试文件、约 112 个 `it/test` 用例，以及 npm RC 包。

这说明它是“可运行的参考实现”。但正式 conformance manifest、runner 和规范测试如何发布，仍在探索性提案中；普通单元测试不能等同于标准认证。Manifest 包也明确说明其 schema 还是本地草案资产，尚没有社区正式分配的 canonical schema URI。

更精确地说：DeepSeek Harness 官方讨论区的 Community v0.15 RFC 将 `dsh-std` 列为“元协议内核探索实现”，采纳了其中元协议与 Facet 方向；它不是 DeepSeek 官方标准，也不是所有扩展协议都已经进入 v0.15 冻结范围。

## 当前成熟度

- 源码主线包版本为 `0.1.1-rc.1`；npm 已发布，但默认 `latest` 仍指向较早的 `0.1.0-rc1` / adapter `0.1.0-rc3`，使用新线需要明确选择 `rc` 标签。
- 仓库没有稳定 release/tag，README 明示代码与提案均为 early drafts。
- 包要求 Node `^22.19 || >=24`。
- DSH Adapter 的开发基线混合使用 DSH `0.1.0-rc.6` 与 `rc.7` 包；peer 范围多为 `*`。这有利于试验，但还不是严格的宿主版本兼容承诺。
- Community v0.15 RFC 明确是非官方讨论稿，并要求传统与标准插件在迁移期共存。

## 与 dsh-codex-migrate 的逐项匹配

### 可以先采用

1. **静态清单和安装前预检**
   
   增加草案 `dsh-plugin.json`，声明 host/browser facets、所需协议、权限和贡献。它可用于 CI 和市场预检，但暂时不要把它当作唯一安装入口，也不要填写一个虚构的 canonical `$schema` URL。

2. **Adapter 隔离原则**
   
   把插件对 `sessionPersistence`、`workspaceRegistry`、Typert Remote 和原生 slots 的访问收口到内部 ports/adapters。这样即使暂时仍调用原生 DSH API，上游升级时也只改一层。

3. **生命周期和所有权**
   
   所有 slot、定时器、远端方法、事件类型和后台任务都绑定一次激活实例并可完整撤销。这个原则可立即落地，与是否切换标准运行时无冲突。

4. **Settings UI 试点**
   
   当前 `@dsh-std/ui-browser` 和 DSH Adapter已实现 `SettingsSection`，可以把设置页做成首个可选标准 browser facet，并保留现有 `settings.section` 原生注册作为兼容回退。

### 目前不能完全替代

1. **会话迁移核心**
   
   本插件依赖 `sessionPersistence` 创建、检查和追加真实 DSH 会话历史。`@dsh-std/session` 当前实现重点是组件自有 `SessionEvent` 词汇；虽然提案描述了 SessionCatalog/History 映射方向，但现有 DSH Adapter 的“当前映射”清单没有提供完整 Session Catalog/History 写入能力。因此不能靠它替换现有 transcript 导入。

2. **工作区与归档**
   
   `@dsh-std/workspace` 已有 WorkspaceCatalog / WorkspaceSessions 的协议类型、协商与 handler，但现有 DSH Adapter 没有把 DSH `WorkspaceRegistry` 完整发布成这些能力。尤其本插件使用的 `archivedSessionIds` / `archiveSession` 属于 DSH 产品状态，提案也明确不把它扩张进基础 WorkspaceSessions。

3. **助手消息操作入口**
   
   本插件注册 `conversation.chat.assistant-actions`。当前浏览器标准面只定义 `SettingsSection` 和 `ToolCallView`，没有对应的 assistant-actions surface，所以主操作按钮仍需原生 slot，或先提议一个新的独立 surface 协议。

4. **插件自定义 RPC**
   
   现有客户端通过 Typert Remote 调用同步、清理、恢复和导入方法。标准 connection 层具备通用协商/调用基础，但本插件需要设计自己的 namespaced 协议和权限边界，并验证 browser facet 到 host facet 的端到端映射，不能只把方法名机械改写。

5. **现有官方安装机制**
   
   标准组件本身不声明 `dsh.bundle`，而是要求宿主先安装 `@dsh-std/adapter-dsh` 再发现 `dsh-plugin.json`。在 Adapter 尚非 DSH 内置组件时，直接删除本插件的 `dsh.bundle` 会增加用户安装前提和失败面。

## 建议采用路线

### 阶段 A：现在就做，低风险

- 先修复独立于标准的 DSH 新版兼容问题：清理未使用的 `dsh-tools` peer、更新/收窄宿主依赖、移除业务插件上的 `dsh.client.immediately: true`、在目标 DSH 版本做 fresh-profile 冒烟测试。
- 引入内部 `SessionPort`、`WorkspacePort`、`ClientBridgePort`、`UiContributionPort`，把原生 DSH 调用集中到适配层。
- 增加草案 `dsh-plugin.json` 和 CI 静态验证，但保留 `package.json#dsh.bundle`。
- 在 README 中标为“dsh-std experimental manifest / optional adapter path”，不要标为 conformant。

### 阶段 B：可选试点

- 使用明确的 `@dsh-std/*@rc` 版本锁定，不跟随浮动 prerelease。
- 将 Settings 页面做成标准 browser facet；原生 slot 保留 feature flag 回退。
- 为同步/导入能力定义一个 namespaced 协议，只做 headless 协商与单元测试，暂不替代生产 RPC。
- CI 同时测试 native path 与 adapter path，记录确切 DSH、Adapter、Node 版本。

### 阶段 C：满足门槛后再切换

只有以下条件成立后，才考虑取消原生实现：

- Community v0.15 或后继版本有 canonical schema、稳定版本政策和可运行 conformance suite；
- `@dsh-std/adapter-dsh` 对 Session History 写入、Workspace 绑定/归档、所需 UI surface 和 browser-host connection 有实际实现与 DSH 集成测试；
- 本插件在官方 DSH 当前稳定/RC 线通过 fresh install、启动、导入、重启恢复、卸载清理和 UI 冒烟；
- Adapter 缺失时能给出安装前兼容诊断，而不是运行时崩溃。

## 最终建议

采纳等级：**有条件采纳（架构与清单先行，运行时渐进迁移）**。

它很适合作为本插件的长期稳定层，而且其目标正中当前痛点：把上游 DSH 的破坏性变化收敛到一个 Adapter。但在 2026-08-28 这个时间点，把全部核心逻辑直接迁过去，会把“上游接口风险”换成“未冻结社区协议 + 不完整产品映射”的双重风险。最佳选择是双轨迁移，而不是押注式重写。

## 主要来源

- https://github.com/Yan-Zero/dsh-std
- https://github.com/Yan-Zero/dsh-std/blob/main/docs/architecture.md
- https://github.com/Yan-Zero/dsh-std/blob/main/docs/proposals/README.zh.md
- https://github.com/Yan-Zero/dsh-std/blob/main/docs/proposals/adapter-dsh.zh.md
- https://github.com/Yan-Zero/dsh-std/blob/main/docs/proposals/conformance.zh.md
- https://github.com/Yan-Zero/dsh-std/blob/main/packages/adapter-dsh/README.md
- https://github.com/Yan-Zero/dsh-std/blob/main/packages/adapter-dsh/package.json
- https://github.com/Yan-Zero/dsh-std/blob/main/packages/manifest/README.zh.md
- https://github.com/Yan-Zero/dsh-std/blob/main/packages/ui-browser/src/index.ts
- https://github.com/deepseek-ai/deepseek-harness/discussions/2714

