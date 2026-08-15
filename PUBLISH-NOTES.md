# 发布与市场收录清单(dsh-codex-migrate)

> 状态:开发、安装验证、端到端功能验证、npm 发布全部完成;剩余可选步骤是 GitHub 仓库/宣传图与市场收录提交。
> 标注【待确认】的条目需在发布时到对应仓库核实最新规范。

## 0. 发布前检查

- [x] `lib/index.js` / `lib/logic.js` / `lib/i18n.js` 语法通过
- [x] `lib/client.js` 已由 `npm run build` 生成(scripts/build-client.js)
- [x] 冒烟测试 scripts/smoke-logic.mjs 通过(扫描/解析/Markdown/MCP/提示词产物)
- [x] remote marker 机制冒烟验证(等价于 @Remote 装饰器)
- [x] **客户端 Remote 挂载修复**:client 必须 `await ctx.remote.$mount(contribution)` 再 `ctx.get('remote.codexSync')`,
      不能静态 `inject: ['remote.codexSync']`(会死锁);修复已合并进 `src/client/index.js` 并重建,
      重建产物与已修复产物字节级一致
- [x] **宿主硬依赖修复**:`sessionPersistence`/`workspaceRegistry` 声明为 inject 硬依赖,
      避免 apply 时服务未就绪导致"服务不可用"跳过导入
- [x] DSH 重启后:宿主行挂载(工具 `codex_sync` 已注册,英文描述)、init 成功(Codex 目录自动检测,零错误)
- [x] 浏览器面挂载:settings.section 实时树中 `codex-sync` 条目 active;设置面板出现
- [x] **面板"消失"根因(陈旧标签页假象)**:逐页采样探针证实插件注册链路全程正常;此前
      Inspect 与视觉上"只有 4 条官方条目"是因为一个 3 小时前打开的旧标签页(其 boot 清单
      早于改名修复)一直抢答 client Inspect 查询。关闭所有旧标签页后,单页验证通过
- [x] 调试代码移除:client 源码中的 `window.__codexMigrateDebug` 采样代码已删除并重建
      (lib/client.js 35162 字符),安装副本字节级一致
- [x] 真实导入:会话 `session-cxmstt3y0k-019fe47f-…` 创建、挂载 meta_research 工作区、state 记录 verified
- [x] 端到端发消息:在导入会话中发消息成功(会话日志出现 DSH 原生 turn 事件,无 400)
- [x] wire 投影合法性:10 个工具调用全部配对,模拟投影完全合法
- [x] `npm pack --dry-run` 通过(10 文件,含 lib/logic.js、lib/i18n.js)
- [x] version 0.1.0;README 双语就绪

## 1. npm 发布

- [x] **已发布 0.1.0**(2026-08-15,账号 nightcrusing):
      `+ dsh-codex-migrate@0.1.0`,`npm view` 确认 version=0.1.0、dist-tags.latest=0.1.0、
      tarball=https://registry.npmjs.org/dsh-codex-migrate/-/dsh-codex-migrate-0.1.0.tgz
- [x] 发布方式:legacy 登录 + 发布带 `--otp`(账号 2FA;Automation token 直发已被 npm 收紧,
      GAT(带 2FA 豁免的 Granular Token)是后续长期方案)
- [ ] 0.1.1(已备好):package.json keywords 已加 `dsh-plugin`(npm 页面 topics 来自 keywords,
      **新版 npm 网站没有 "Package Topics" 编辑入口**),发布命令同上带 --otp
- [ ] GitHub 仓库建好后,在仓库主页 About 区添加 GitHub topic **`dsh-plugin`**——
      这才是 awesome-deepseek-harness 聚合的开关(它聚合 dsh-external/hub + 公共 dsh-plugin topic)
- 【待确认】dsh-market 的 npm 映射是否自动拉取新包(其 README 称 curated entries
  + npm mapping,CI 每日刷新)——若自动,无需额外动作;若非自动,按其 CONTRIBUTING 提交
- 建议(可选):建 GitHub 仓库,在 package.json 补 `repository` 字段,提升可信度

## 2. 市场/列表收录入口

| 入口 | 方式 | 状态 |
| --- | --- | --- |
| dsh-market(dsh-market/dsh-market) | 内置 DSH 的可视化市场;npm 映射 + curated entries,CI 每日刷新 | 【待确认】收录入口(CONTRIBUTING) |
| awesome-deepseek-harness(0xsline) | 聚合 dsh-external/hub 与公共 dsh-plugin topic | 发布 + topic 即可被聚合;可选提 PR 进精选列表 |
| awesome-dsh-plugin | 精选列表 + badge | 提 PR 添加条目 |
| vlln/plugin-registry + make-dsh-plugin skill | 官方格式插件开发引导与 registry 控制台 | 参考其 registry 清单格式提 PR(可选) |

官方发布教程(打包/安装规范):
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md

## 3. 用户侧安装方式(README 已写)

```bash
dsh plugin --profile web add dsh-codex-migrate
```

或手动把 cordis.patch.yml 的 insert 行合并进 profile patch。

## 4. 与本机动态插件的关系(迁移说明)

- 动态插件 codexs-1(v29)在 DSH 重启后自然消失;静态包接管同名工具 `codex_sync`。
- 静态包默认输出目录 `<DSH_HOME>/codex-sync`(新的干净目录);
  老用户如需沿用动态版数据,可把 `outputDir` 配置为 `D:\deepseek-work`
  (旧数据在 `D:\deepseek-work\.codex-sync`,注意静态版不追加 `.codex-sync`
  后缀——如需精确复用,把 outputDir 设为 `D:\deepseek-work\.codex-sync`)。
