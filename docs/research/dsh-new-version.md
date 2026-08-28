# DSH 新版本、插件兼容性与“社区标准”调研

> 调研日期：2026-08-28  
> 对象：`dsh-codex-migrate` 2.0.0、当前 npm 默认 DSH、GitHub 最新预发布版  
> 证据口径：优先采用 DSH 官方仓库、官方 Release、官方文档、规范原文；社区提案和本地静态核验会单独标注，避免把“提案”写成“官方标准”，或把“静态可迁移”写成“已通过兼容测试”。

## 结论先行

1. **不能笼统地说“为 0.1 开发的插件都不能用了”。** DSH 目前仍处在 0.1 预发布阶段，官方明确警告会发生兼容性破坏；但本插件所用的官方 bundle/patch 装载方式仍在，Host 端也已经使用新式 `@Remote`/`$mount()`，而不是已经被删除的旧 APIProxy。对 0.1.1-rc.2 发行包的静态检查还确认了主要 session、workspace、Typert 接口仍存在。因此它更准确的状态是：**可迁移、很可能能继续工作，但当前发布物不能声明已兼容新版本。** [Developer Preview 警告](https://github.com/deepseek-ai/deepseek-harness#developer-preview)；[插件发布/Bundle 机制](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/docs/user/develop/basic/publish.md)；[API Gateway 文档](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/docs/api-gateway.md)
2. **当前最明确的安装级阻断是版本范围。** 本地 [package.json](../../package.json) 的 DSH peers 仍为 `^0.1.0-rc.6`；npm 已发布的本插件 0.1.3 也采用同一范围。按 npm/node-semver 的预发布规则，这个范围不会接受不同补丁/次版本三元组的 `0.1.1-rc.2` 或 `0.1.2-alpha.1`。因此，在正常 peer 校验下它们不是一个受支持组合；粗暴改成 `*` 又可能引入 DSH 核心包重复实例问题。[node-semver 预发布规则](https://github.com/npm/node-semver#prerelease-tags)；[npm 上的插件版本](https://www.npmjs.com/package/dsh-codex-migrate?activeTab=versions)
3. **“社区标准”最可能是 DSH Community Fabric。它是有价值的早期 RFC，不是官方标准，也还不是可直接接入的 SDK。** 当前文本自己明确写明：Draft/文档阶段，没有可用 runtime、已发布 schema、兼容徽章或 conformance tests；v0.1 只优先定义 Host/Node 侧少量能力，浏览器 Client Facet、跨面通信和本项目依赖的 UI/session 写入能力仍待后续。因此建议现在采纳其架构原则，**暂不宣称兼容或重写到它上面**。[DSH Discussion #2714](https://github.com/deepseek-ai/deepseek-harness/discussions/2714)；[Fabric 中文说明](https://github.com/anywhere-labs/dsh-desktop/blob/master/dsh-community-fabric/README.zh.md)；[RFC 0001](https://github.com/anywhere-labs/dsh-desktop/blob/master/dsh-community-fabric/docs/rfcs/0001-plugin-manifest-capabilities-events.zh.md)
4. **Registry Contract v2 是另一个值得借鉴的社区提案，但它解决发布目录、安装证据和诊断，不解决运行时 API 兼容。** 可以马上吸收其“固定安装源、校验摘要、已验证 DSH 版本、检查时间和检查项”等发布证据字段，同时继续保留 DSH 官方 `dsh.bundle`。[Discussion #1846](https://github.com/deepseek-ai/deepseek-harness/discussions/1846)
5. **真实宿主门禁尚未通过。** 隔离 fresh-profile 的完整安装因为原生依赖编译超时而中止；所以本文没有把静态接口存在、单元测试或构建成功等同于“能在新 DSH 中安装、启动、导入并重启恢复”。这是发布兼容声明之前必须补做的测试。

## 1. 版本基线：这里其实有两个“新版本”

| 渠道 | 2026-08-28 核验结果 | 应如何理解 |
|---|---|---|
| 当前机器 | `0.1.0-rc.6` | 本插件最可能实际开发、运行过的基线 |
| npm 默认 dist-tag | `latest = 0.1.1-rc.2`，`next = 0.1.1-rc.2` | 普通 `npx @deepseek-ai/dsh web` 或不锁版本安装时最相关的目标；可在 [npm 版本页](https://www.npmjs.com/package/@deepseek-ai/dsh?activeTab=versions) 复核 |
| GitHub Releases | `0.1.2-alpha.1`，2026-08-27 | 官方仓库的最新公开预发布，但不是 npm 默认 latest；见 [0.1.2-alpha.1 Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1) |

这一区分很重要：**不能只说“兼容最新版”**。至少应分别写明 `0.1.1-rc.2`（npm 默认）与 `0.1.2-alpha.1`（GitHub 最新预发布），并固定精确版本测试，不能用浮动 `latest` 充当兼容矩阵。

## 2. 从 0.1.0-rc.6/rc.7 到新版本，哪些变化与插件有关

### 2.1 官方明确给出的破坏性变化

- DSH 官方 README 将项目标为 Developer Preview，并明确提示会有 compatibility-breaking changes。因此 0.1.x 的小版本/候选版本号本身不构成 API 稳定承诺。[官方 README](https://github.com/deepseek-ai/deepseek-harness#developer-preview)
- `0.1.2-alpha.1` 移除了旧 APIProxy，要求业务服务采用 `@Remote`；会话视图代码被大幅拆层，客户端应按新的分层包导入；所有 app 统一通过 DSH profiles 启动；Code Mode 改名为 PTC，但旧历史仍可读取。[0.1.2-alpha.1 Release Notes](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1)
- 更早的 `0.1.0-rc.8` 已明确包含不兼容的 SQLite 存储格式变化。这意味着任何直接构造并写入 SessionEvent 的第三方插件，都不能仅凭 TypeScript/JavaScript 方法名还存在就假定数据格式仍兼容。[0.1.0-rc.8 Release Notes](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.0-rc.8)

### 2.2 包布局与客户端依赖发生了迁移

对官方 tag 的包目录与 manifest 进行对比，变化包括：

- `@deepseek-ai/dsh-client-web-react` 在 rc.7 尚存在，但到 rc.2/alpha.1 已不再是当前包，渲染入口转为 `@deepseek-ai/dsh-client-ui-renderer`。[官方版本对比](https://github.com/deepseek-ai/deepseek-harness/compare/dsh-v0.1.0-rc.7...dsh-v0.1.2-alpha.1)；[alpha.1 ui-renderer manifest](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/packages/client/ui-renderer/package.json)
- `@deepseek-ai/dsh-client-runtime` 在 `0.1.1-rc.2` 仍存在，到 `0.1.2-alpha.1` 已被拆走；会话控制服务位于 `@deepseek-ai/dsh-api-session-controller`。[alpha.1 session-controller manifest](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/packages/api/session-controller/package.json)
- `settings.section` 与 `conversation.chat.assistant-actions` 在最新源码中仍可找到；后者的声明归属移动到了 UI chat 层。这说明插槽概念没有整体消失，但插件 manifest 的包名提示和目标版本必须更新。[官方版本对比](https://github.com/deepseek-ai/deepseek-harness/compare/dsh-v0.1.0-rc.7...dsh-v0.1.2-alpha.1)

官方当前客户端说明还指出：`dsh.client.inject` 中的**包名边只是预检/HMR 信息，不负责真正决定服务激活顺序**；实际顺序由 Cordis service injection 决定。这使陈旧包名不一定单独导致立即崩溃，但它仍会造成预检、热更新、装载诊断与未来版本漂移，必须修正，不能据此视为无害。[客户端维护说明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/packages/client/AGENTS.md)

## 3. 当前插件究竟还能不能用

### 3.1 有利证据：不是“API 全灭”

本地代码与官方产物静态核验得到以下结果：

| 当前用法 | 新版状态 | 判断 |
|---|---|---|
| `dsh.bundle.patch` + `cordis.patch.yml` + profile 安装 | 官方当前发布文档仍采用这一机制 | 外层插件包结构仍有效；[官方发布文档](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/docs/user/develop/basic/publish.md) |
| `Remote`、`TypertRemoteService`、客户端 `ctx.remote.$mount()` | 官方 API Gateway 当前推荐模式；0.1.1-rc.2 Typert 发行包中相应基类仍存在 | 本插件已经避开 alpha.1 删除的旧 APIProxy；[API Gateway](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/docs/api-gateway.md) |
| `SessionInspection.meta/events`、persistence `create/append` | 直接检查 0.1.1-rc.2 `dsh-session-persistence` 发行 tarball，仍存在 | 静态 API 面可迁移，但事件 schema/存储语义仍需运行验证 |
| `Workspace.attachSession`、`archiveSession`、`archivedSessionIds` | 直接检查 0.1.1-rc.2 workspace 发行 tarball，仍存在 | 当前主要 workspace 调用没有被整体删除 |
| `settings.section`、`conversation.chat.assistant-actions` | 0.1.1-rc.2 `ui-slots` 发行包/当前 master 静态核验仍存在 | UI 扩展点大体保留，但包归属/载入路径有迁移 |

### 3.2 当前发布物仍不能宣称兼容的原因

1. **Peer range 不接受目标预发布。** [package.json](../../package.json) 将 `dsh-home-paths`、`dsh-tools`、`dsh-typert-protocol` 限为 `^0.1.0-rc.6`。node-semver 对 prerelease 的规则要求比较器中有相同 `major.minor.patch` 的 prerelease 才能纳入；所以它不能覆盖 `0.1.1-rc.2` 或 `0.1.2-alpha.1`。[node-semver](https://github.com/npm/node-semver#prerelease-tags)
2. **客户端 manifest 指向已迁移/移除的包。** 当前还写着 `dsh-client-web-react`；alpha.1 中还需要将 `dsh-client-runtime` 的定位迁移到 `dsh-api-session-controller`。即便这些包名边不直接控制激活，也会让包图和预检信息失真。
3. **`immediately: true` 与当前官方约定不匹配。** 最新客户端维护说明把 immediate 预留给第一阶段预取的基础设施行；这个导入工具属于业务插件，不应无证据地保持立即启动。[客户端维护说明](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/packages/client/AGENTS.md)
4. **Remote 描述符是手写的。** 官方流程倾向从服务契约生成严格的 `typert.host.js`、`typert.remote-client.js`，并通过包的 `./typert`、`./remote` 导出连接。当前手写描述符可能仍能工作，但比生成物更容易随协议演进漂移。[API Gateway](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/docs/api-gateway.md)
5. **直接写 SessionEvent 是数据兼容高风险区。** 当前导入流程创建 `version: 0` 记录并调用 persistence `create/append`。接口方法存在不代表事件版本、索引、不变量和恢复行为没有变化，尤其官方曾明确更换 SQLite 格式。[rc.8 Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.0-rc.8)
6. **核心 peer 可能产生双实例。** 社区已有可复现报告：profile 局部安装了第二份 `dsh-tools` 后，模块内部 Symbol 不同，导致工具调度整体失败。该讨论尚不是官方已解决政策，但足以要求在门禁里检查真实解析路径。[Discussion #1849](https://github.com/deepseek-ai/deepseek-harness/discussions/1849)。本插件运行时代码并未直接 import `dsh-tools`，该 peer 值得评估是否移除；它确实 import Typert 协议，因此 Typert 双实例尤其要防止，不能简单把所有 peer 改成 `*` 就结束。

### 3.3 精确回答

**现状：**

- 在原开发/实测基线 `0.1.0-rc.6` 上，仍可按原有支持范围使用。
- 在 npm 默认 `0.1.1-rc.2` 上，静态 API 核验显示“总体可迁移、大概率兼容”，且 `dsh-client-runtime` 尚未消失；但 `web-react` 包名、peer range、单例解析和真实宿主行为未完成门禁，所以不能作为已支持版本发布。
- 在 GitHub `0.1.2-alpha.1` 上，还需适配 session-controller/UI 包拆分；风险高于 rc.2，但 Remote、slots、主要 session/workspace 概念仍在，也不是从零重写。

**满足以下任一条件才可以放心继续用：**

- 锁定精确的 `0.1.0-rc.6`，并保持与原测试环境相同的核心包单实例；或
- 选择一个明确目标（先 rc.2，再 alpha.1），完成 manifest/peer/Remote 产物迁移，并通过 fresh-profile 的安装、启动、导入、重启恢复和工具回归测试。

## 4. “社区标准”是什么

### 4.1 DSH Community Fabric v0.15

这是目前最符合“社区标准”描述的提案。它试图让插件不再直接耦合某一版 DSH 内部实现，而通过静态 `dsh-plugin.json`、版本化 capability contracts、Capability Broker、DSH adapter 和 effect ledger 建立可移植边界。结构上采用 `Component → Facet → Activation → Participant`，并区分 Host、Client、Worker Facet；manifest 草案包含 `requires`、`permissions`、`provides`、`contributes`、`subscriptions` 等字段。[DSH 官方仓库中的社区讨论 #2714](https://github.com/deepseek-ai/deepseek-harness/discussions/2714)；[Fabric README](https://github.com/anywhere-labs/dsh-desktop/blob/master/dsh-community-fabric/README.zh.md)

**成熟度：早期 Draft/RFC，不是官方稳定规范。**

- 提案明确表示不是 DSH 官方标准，也没有要求立即采纳；现有 DSH/Cordis manifest 与 slots 不会因提案自动失效。[Discussion #2714](https://github.com/deepseek-ai/deepseek-harness/discussions/2714)
- 规范仓库明确说目前只有文档：没有 runtime、SDK、schema release、兼容徽章或可加载插件。[Fabric README](https://github.com/anywhere-labs/dsh-desktop/blob/master/dsh-community-fabric/README.zh.md)
- RFC 0001 仍为 Draft；其中的 MUST/SHOULD 在 RFC 接受、schema 发布和 conformance tests 存在前不构成稳定承诺。[RFC 0001](https://github.com/anywhere-labs/dsh-desktop/blob/master/dsh-community-fabric/docs/rfcs/0001-plugin-manifest-capabilities-events.zh.md)
- v0.1 的落地范围主要是 Host/Node，候选能力只有 `storage.local`、`commands`、`messages.observe`；browser/client/worker、通信、`sessions.read` 以及 session action、网络、文件系统等能力均后置。[RFC 0001](https://github.com/anywhere-labs/dsh-desktop/blob/master/dsh-community-fabric/docs/rfcs/0001-plugin-manifest-capabilities-events.zh.md)

**维护与采用信号：有人推进，但还没有形成广泛、稳定的生态事实。**

- 规范文本主要托管在 `anywhere-labs/dsh-desktop/dsh-community-fabric`，跨仓库协作入口是 [omdsh-dev/community](https://github.com/omdsh-dev/community)；治理 RFC 本身也仍在形成中。
- #2714 中出现了 Blue Whale 目录拟收录兼容插件、TUI 声称实现、`dsh-std` PoC 与 Codex 分支验证 Facet 等早期信号，但讨论参与者和实现数量仍有限，也没有看到 DSH 官方维护者宣布接纳为官方标准。[Discussion #2714](https://github.com/deepseek-ai/deepseek-harness/discussions/2714)

**与本项目的匹配度：理念高，当前可执行覆盖低。** 本插件同时依赖 Host 与 Client、Remote 跨面调用、设置页/会话 action 插槽、session/workspace 写入、工具和文件访问；Fabric v0.1 恰好还没有稳定覆盖其中大多数能力。因此现在不能用它替换官方 DSH API，只能先做内部解耦，为以后接 broker/adapter 留接口。

### 4.2 Registry Contract v2 / `plugin check` / `doctor`

这是另一个社区提案，目标是让插件目录有稳定 id、权威安装坐标、窄范围 verified 版本、source、计数不变量，并为 `dsh plugin check` 设计 0/1/2 退出语义、为 `dsh doctor` 设计安装诊断。[Discussion #1846](https://github.com/deepseek-ai/deepseek-harness/discussions/1846)

它的参考实现曾在 rc.6 上显示 CI 通过，但提案自身写的是先收集讨论反馈、待上游重新开放 PR 后再提交；没有看到官方接受记录。因此它应被称为**社区分发/诊断契约提案**，而不是运行时插件标准。它不能替代 `dsh.bundle`，却非常适合被本项目用于发布证据。

### 4.3 ACP 不是这里的插件标准

`0.1.2-alpha.1` 增强的 ACP v1 是跨客户端控制 Agent 的协议，支持会话 create/resume/list/close、MCP、模型/推理设置、prompt/cancel 与语义更新；官方同时列出不支持删除、fork、transcript replay、额外目录和 DSH 私有 UI。[DSH ACP README](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.1/packages/acp/acp/README.md)；[ACP v1 规范](https://github.com/agentclientprotocol/agent-client-protocol/blob/main/docs/protocol/v1/overview.mdx)

它适合未来作为“实时自动化/控制”传输，但不能替代本项目的 Codex 历史解析与完整记录导入，不应与 Community Fabric 混为一谈。

## 5. 能否采纳：建议分层采纳

| 决策 | 现在做什么 | 原因 |
|---|---|---|
| **立即采纳** | 固定并记录精确 DSH 目标版本；发布物记录安装源/commit、artifact SHA-256、验证 DSH 版本、检查时间与检查清单 | 来自 Registry v2 的证据化思路，风险低，不依赖社区 runtime |
| **立即采纳** | 在本项目内部建立版本化 DSH adapter 边界；把 session persistence、workspace、Typert、client slots 的直接调用集中封装 | 符合 Fabric 的能力隔离思想，也直接降低 DSH 预发布 API 漂移成本 |
| **立即采纳** | 为插件组件记录 Host/Client facet、required/optional capabilities、降级策略；让每次 activation 拥有并清理自己产生的 effect | 是可逆的内部设计，不需要宣称标准兼容 |
| **暂缓** | 对外发布 `dsh-plugin.json`，或加“Community Fabric compatible”徽章 | canonical schema、SDK、runtime、conformance 尚未发布；容易产生虚假兼容声明和命名冲突 |
| **暂缓** | 用 Fabric broker 全面替换 Cordis/DSH API | Fabric 还不覆盖本插件关键的 Client UI、session mutation、跨面通信 |
| **可选后续** | 以 ACP 增加实时 DSH 会话控制 | ACP 能补充自动化入口，但不是历史导入替代品 |

建议的产品表述是：**“采用 Community Fabric 的 capability/adapter/effect-management 设计原则，并跟踪其 RFC；当前继续使用 DSH 官方 bundle 与 API，不宣称 Fabric conformance。”**

## 6. 推荐迁移步骤

1. **建立两条精确版本线。** 先把 npm 默认 `0.1.1-rc.2` 作为近期兼容目标，再单独验证 `0.1.2-alpha.1`；安装和 CI 都锁精确版本。
2. **先做未改代码的 fresh-profile 基线。** 用真正打包后的 tarball 安装到空 profile，记录包解析树、启动日志和失败点。此前完整安装因原生依赖编译超时而中止，必须重跑，不能引用为成功证据。
3. **清理 peer 与单例关系。** 核对 `cordis`、`dsh-typert-protocol`、`dsh-home-paths`、`dsh-tools` 的真实解析路径；评估移除运行时未导入的 `dsh-tools` peer；为 Cordis/Typert 等增加“只能解析为宿主同一实例”的门禁。不要只把范围放宽为 `*`。
4. **按目标版本更新客户端元数据。** rc.2 至少将 `dsh-client-web-react` 迁到 `dsh-client-ui-renderer`；alpha.1 还要把 session 依赖从 `dsh-client-runtime` 迁到 `dsh-api-session-controller`，并按实际 slot 服务关系记录 UI chat 依赖；移除业务插件不适合的 `immediately: true`。
5. **收敛 Remote 契约。** 在可行范围内改为官方生成的 `./typert`/`./remote` 产物，消除手写 host/client 描述符的漂移风险。
6. **集中 DSH adapter。** 对 session、workspace、remote、slots 建立内部版本适配层；导入核心只依赖项目自己的窄接口。将来 Fabric 真正发布 SDK 时，只需增加 adapter，而不是改写全部业务逻辑。
7. **运行真实兼容门禁。** 对每个目标版本至少覆盖：插件安装/卸载、DSH 启动、其他内置工具仍可调度、Codex→DSH 导入、打开导入会话、退出并重启后重新打开、设置页和 assistant action、错误/取消路径、重复导入与归档；同时检查没有第二份 Cordis/Typert/工具核心包。
8. **发布兼容矩阵与证据。** 明确写“tested with exact version”，保存 tarball digest、Node/平台、测试结果和日期；静态兼容只能标为 `candidate`，不得标成 `supported`。
9. **等待 Fabric 可执行里程碑。** 至少等 canonical schema id、runtime/SDK、一个正式 conformance suite 与 Client Facet 能力发布后，再实现双路径 adapter 并申请/声明兼容。

## 7. 主要风险与门禁

| 风险 | 严重度 | 发布门禁 |
|---|---:|---|
| SessionEvent/SQLite 语义变化造成导入后无法重启读取或数据损坏 | 高 | 在副本/空 profile 中完成导入、重启、重开与归档测试；不得先在用户主 profile 试验 |
| Typert/Cordis/dsh-tools 双实例导致 marker 或 Symbol 身份不一致 | 高 | 输出并断言真实解析路径；内置工具回归必须通过 |
| alpha.1 客户端包拆分造成服务未注入、slot action 不出现 | 高 | settings 和 assistant-action 两个 UI 入口都做真实浏览器 smoke test |
| 只改 peer range，误把静态接口存在当成兼容 | 高 | 只有完整 fresh-profile 宿主测试通过才进入 `supported` 矩阵 |
| 过早声称 Community Fabric 兼容 | 中高 | schema + conformance 未发布前不发 manifest/徽章，不使用“标准兼容”措辞 |
| 同时维护官方 API 与社区抽象导致复杂度上升 | 中 | 先做窄 adapter 和内部 capability 描述，不引入未发布 runtime |
| capability 声明被误认为安全沙箱 | 中 | 明确说明声明用于协商/诊断；Fabric 草案本身并不把受信任的进程内插件自动变成沙箱 |

## 最终判断

- **插件不是“彻底不能用”，但当前版本也不能原样宣布支持 DSH 新版。** 对 rc.2 的静态证据较乐观；对 alpha.1 需要额外客户端包迁移。真正决定能否发布的是 fresh-profile 宿主门禁，而不是方法名还存在。
- **社区标准可以“采纳思想”，暂不能“采纳实现”。** 现在最合适的投入是 adapter/capability/effect 生命周期设计与可追溯发布证据；不要发 Fabric 兼容声明，也不要为了草案重写现有插件。
- **建议优先级：** 先完成 `0.1.1-rc.2` 迁移与实测，再验证 `0.1.2-alpha.1`；与此同时用社区提案改善架构和发布证据，等规范具备 schema、SDK 与一致性测试后再正式接入。
