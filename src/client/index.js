const React = require('react')

const CSS = `
.cxs-wrap { display: flex; flex-direction: column; gap: 14px; padding: 4px 0 36px; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 1.5; }
.cxs-card { position: relative; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 16px; padding: 16px 18px; box-shadow: 0 1px 0 color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent); }
.cxs-card h3 { margin: 0 0 12px; font-size: 14px; line-height: 20px; font-weight: 600; color: var(--dsw-alias-label-primary); letter-spacing: -0.01em; }
.cxs-row { display: flex; min-height: 32px; align-items: center; gap: 10px; padding: 3px 0; flex-wrap: wrap; }
.cxs-row.spread { justify-content: space-between; }
.cxs-row label, .cxs-row span { color: var(--dsw-alias-label-primary); }
.cxs-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.cxs-input { box-sizing: border-box; height: 34px; flex: 1; min-width: 220px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); border-radius: 10px; padding: 7px 11px; font: inherit; font-size: 12px; outline: none; transition: border-color .15s ease, box-shadow .15s ease; }
.cxs-input:focus, .cxs-select:focus, .cxs-num:focus { border-color: var(--dsw-alias-brand-primary); box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 18%, transparent); outline: none; }
.cxs-select { box-sizing: border-box; min-height: 34px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); border-radius: 10px; padding: 6px 28px 6px 10px; font: inherit; font-size: 12px; }
.cxs-num { box-sizing: border-box; width: 110px; height: 34px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); border-radius: 10px; padding: 6px 10px; font: inherit; font-size: 12px; }
.cxs-btn { min-height: 32px; background: var(--dsw-alias-brand-primary); color: #ffffff; border: none; border-radius: 10px; padding: 7px 14px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity .15s ease, background .15s ease; }
.cxs-btn:hover { opacity: 0.9; }
.cxs-btn:disabled { opacity: 0.55; cursor: default; }
.cxs-btn.ghost { background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.cxs-btn.ghost:hover { background: var(--dsw-alias-interactive-bg-hover); }
.cxs-btn.sm { min-height: 26px; padding: 3px 9px; font-size: 11px; font-weight: 500; border-radius: 8px; }
.cxs-status { padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 12px; word-break: break-all; }
.cxs-msg { color: var(--dsw-alias-state-success-primary); font-size: 12px; white-space: pre-wrap; word-break: break-all; }
.cxs-err { color: var(--dsw-alias-state-error-primary); font-size: 12px; word-break: break-all; }
.cxs-list { max-height: 300px; overflow-y: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 11px; padding: 6px; background: var(--dsw-alias-bg-layer-2); display: flex; flex-direction: column; gap: 2px; scrollbar-gutter: stable; }
.cxs-item { display: flex; min-height: 30px; align-items: center; gap: 8px; padding: 3px 5px; border-radius: 7px; font-size: 12px; color: var(--dsw-alias-label-primary); }
.cxs-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
.cxs-wrap input[type='checkbox'], .cxs-wrap input[type='radio'] { accent-color: var(--dsw-alias-brand-primary); }
.cxs-item .meta { color: var(--dsw-alias-label-secondary); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.cxs-badge { font-size: 10px; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.cxs-badge.done { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.cxs-badge.out { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.cxs-badge.kind { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
.cxs-imported { display: grid; gap: 6px; }
.cxs-imported-row { display: flex; align-items: center; gap: 9px; min-height: 38px; padding: 6px 8px; border-radius: 9px; background: var(--dsw-alias-bg-layer-2); }
.cxs-imported-copy { min-width: 0; flex: 1; display: grid; gap: 1px; }
.cxs-imported-title { color: var(--dsw-alias-label-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cxs-message-action { width: 28px; height: 28px; color: var(--dsw-alias-label-tertiary); cursor: pointer; background: transparent; border: none; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; padding: 6px; }
.cxs-message-action:hover { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-interactive-bg-hover); }
.cxs-message-action:disabled { cursor: default; opacity: .4; }
.cxs-message-action svg { width: 16px; height: 16px; fill: currentColor; shape-rendering: geometricPrecision; }
@media (max-width: 620px) { .cxs-card { border-radius: 13px; padding: 14px; } .cxs-input { min-width: 160px; } }
`

const NS = 'codex-sync'
const CODEX_ICON_PATH = 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'

const zh = {
  nav: 'Codex 迁移',
  dataSource: '数据源',
  codexDir: 'Codex 目录',
  codexDirPlaceholder: '例如 C:\\Users\\you\\.codex',
  autoDetect: '自动检测',
  detecting: '检测中…',
  detected: '已检测到: {path}',
  notDetected: '未自动检测到 Codex 目录,请手动填写。',
  detectFail: '检测失败: {err}',
  outputDir: '输出目录',
  outDirPlaceholder: '留空 = 自动(DSH 数据目录)',
  currentOut: '当前输出: {path}',
  languageLabel: '语言',
  schedule: '同步计划',
  freq: '同步频率',
  autoSync: '自动同步(按上方频率周期执行)',
  nextSync: '下次同步',
  save: '保存配置',
  saving: '保存中…',
  saved: '配置已保存。',
  saveFail: '保存失败: {err}',
  contents: '同步内容',
  sessionsHistory: '会话历史(JSONL → Markdown)',
  kinds: '会话种类:',
  userKind: ' 用户对话(自然语言)',
  subKind: ' 子智能体',
  otherKind: ' 其他/未知',
  importDsh: '同时导入为 DSH 会话(每个 Codex 项目生成对应工作区)',
  includeArchived: '归档会话(archived_sessions)',
  includeMcp: 'MCP 服务器 → cordis.yml 行',
  includeMemories: '记忆(memories/*.md)',
  includeAgentsMd: 'AGENTS.md',
  includeProjectFiles: '项目文件(文本,跳过 .git/node_modules/二进制)',
  maxFileKB: '单文件大小上限(KB)',
  projectScope: '项目范围',
  allProjects: ' 全部项目',
  manualSelect: ' 手动选择',
  refreshInventory: '刷新清单',
  loadingInventory: '加载中…',
  inventoryRefreshed: '清单已刷新。',
  inventoryFail: '清单刷新失败: {err}',
  sessionScope: '会话范围',
  allInProject: ' 全部(项目范围内)',
  newOnly: ' 仅新会话(项目范围内)',
  showSubagents: '显示子智能体线程(内部审查/守护对话,默认隐藏)',
  mcpScope: 'MCP 范围',
  allServers: ' 全部服务器',
  getPrompt: '获取 MCP 注册提示词',
  fetching: '获取中…',
  copyPrompt: '复制提示词',
  promptReady: '提示词已生成(同步时自动更新)。',
  promptFail: '获取提示词失败: {err}',
  copied: '✅ 已复制。把它发给任意一个 agent 会话,即可让 agent 完成 MCP 注册。',
  copyUnavailable: '自动复制不可用,请手动选中下方文本复制。',
  status: '状态',
  statusLoading: '加载中…',
  statusSyncing: '⏳ 正在同步…',
  statusNotSynced: '尚未同步。',
  statusFail: '❌ {err}',
  sessionsCount: '会话: {imported} 新增 / {unchanged} 未变 / {skipped} 跳过(含子智能体) / {deleted} 本地已删 / {failed} 失败',
  dshCount: 'DSH 会话: +{imported}',
  dshAttached: ' (挂载 {attached})',
  mcpCount: 'MCP: {n} 个',
  memoriesCount: '记忆: {n}',
  projectsCount: '项目文件: {n} 个',
  syncNow: '立即同步',
  syncing: '同步中…',
  clearAll: '清空已导入对话',
  clearConfirm: '确认清空已导入对话？这会归档已导入的 DSH 会话，并从工作区解除挂载。',
  clearing: '清空中…',
  syncFail: '同步失败: {err}',
  cleared: '已清空导入: 归档 {archived} 个会话, 从工作区移除 {detached} 个, 删除 Markdown {md} 个。现在可选择导入。',
  clearFail: '清空失败: {err}',
  deleted: '已删除并从同步范围排除。',
  delFail: '删除失败: {err}',
  del: '删除',
  restored: '已恢复,下次同步将重新导入。',
  restoreFail: '恢复失败: {err}',
  restore: '恢复',
  initProblem: '初始化问题: {err}',
  recentErrors: '最近错误: {errs}',
  stateReadFail: '状态读取失败: {err}',
  noSessions: '没有符合条件的会话。',
  noSessionsProj: '所选项目下没有会话(或尚未勾选项目/显示子智能体)。',
  hintSessions: '点击“刷新清单”加载会话列表',
  hintMcp: '点击“刷新清单”加载 MCP 列表',
  hintProjects: '点击“刷新清单”加载项目列表',
  kindUser: '用户',
  kindSub: '子智能体',
  kindOther: '其他',
  internal: '(内部) ',
  imported: '已导入',
  excluded: '已排除',
  notImported: '未导入',
  notIncluded: '未包含',
  manualFreq: '手动(不自动)',
  every5m: '每 5 分钟',
  every15m: '每 15 分钟',
  every30m: '每 30 分钟',
  hourly: '每小时',
  every6h: '每 6 小时',
  daily: '每天',
  manualOnly: '仅手动同步',
  waitingNext: '等待下一次调度',
  inProgress: '进行中…',
  importedConversations: '已导入的对话',
  noImportedConversations: '还没有导入对话。完成一次同步后会显示在这里。',
  continueInCodex: '在 Codex 继续',
  continuingInCodex: '正在注册到 Codex…',
  continueInCodexFail: '注册到 Codex 失败: {err}',
  bridgeMemory: '记忆导入',
  memoryProvider: '支持的记忆类型',
  memoryHint: '每次单向同步时读取所选来源；内容按来源分目录保存，不会互相覆盖。AGENTS.md 仍作为项目指令独立导入。',
  memoryBuiltin: 'Codex MEMORY.md / memories/*.md',
  memoryMcp: '桥接 MCP 持久记忆',
  memorySkill: 'Memory Skill（~/memory/**/*.md）',
  dshProjects: '按照项目批量迁移',
  loadDshProjects: '读取 DSH 项目',
  transferProject: '转移到 Codex',
  transferringProject: '正在转移…',
  transferredProject: '已将 {count} 个对话导入 Codex。',
}

const en = {
  nav: 'Codex Migration',
  dataSource: 'Data Source',
  codexDir: 'Codex directory',
  codexDirPlaceholder: 'e.g. C:\\Users\\you\\.codex',
  autoDetect: 'Auto-detect',
  detecting: 'Detecting…',
  detected: 'Detected: {path}',
  notDetected: 'Could not auto-detect the Codex directory; enter it manually.',
  detectFail: 'Detection failed: {err}',
  outputDir: 'Output directory',
  outDirPlaceholder: 'Empty = automatic (DSH data dir)',
  currentOut: 'Current output: {path}',
  languageLabel: 'Language',
  schedule: 'Schedule',
  freq: 'Sync frequency',
  autoSync: 'Auto sync (runs periodically at the frequency above)',
  nextSync: 'Next sync',
  save: 'Save config',
  saving: 'Saving…',
  saved: 'Config saved.',
  saveFail: 'Save failed: {err}',
  contents: 'Sync Contents',
  sessionsHistory: 'Session history (JSONL → Markdown)',
  kinds: 'Session kinds:',
  userKind: ' User conversations (natural language)',
  subKind: ' Subagents',
  otherKind: ' Other/unknown',
  importDsh: 'Also import as DSH sessions (creates a workspace per Codex project)',
  includeArchived: 'Archived sessions (archived_sessions)',
  includeMcp: 'MCP servers → cordis.yml rows',
  includeMemories: 'Memories (memories/*.md)',
  includeAgentsMd: 'AGENTS.md',
  includeProjectFiles: 'Project files (text; skips .git/node_modules/binaries)',
  maxFileKB: 'Max file size (KB)',
  projectScope: 'Project Scope',
  allProjects: ' All projects',
  manualSelect: ' Select manually',
  refreshInventory: 'Refresh inventory',
  loadingInventory: 'Loading…',
  inventoryRefreshed: 'Inventory refreshed.',
  inventoryFail: 'Inventory refresh failed: {err}',
  sessionScope: 'Session Scope',
  allInProject: ' All (within project scope)',
  newOnly: ' New sessions only (within project scope)',
  showSubagents: 'Show subagent threads (internal review/guardian chats; hidden by default)',
  mcpScope: 'MCP Scope',
  allServers: ' All servers',
  getPrompt: 'Get MCP registration prompt',
  fetching: 'Fetching…',
  copyPrompt: 'Copy prompt',
  promptReady: 'Prompt generated (auto-updated on each sync).',
  promptFail: 'Failed to fetch prompt: {err}',
  copied: '✅ Copied. Send it to any agent session to complete the MCP registration.',
  copyUnavailable: 'Auto-copy unavailable; select and copy the text below manually.',
  status: 'Status',
  statusLoading: 'Loading…',
  statusSyncing: '⏳ Syncing…',
  statusNotSynced: 'Not synced yet.',
  statusFail: '❌ {err}',
  sessionsCount: 'Sessions: {imported} new / {unchanged} unchanged / {skipped} skipped (incl. subagents) / {deleted} deleted locally / {failed} failed',
  dshCount: 'DSH sessions: +{imported}',
  dshAttached: ' (attached {attached})',
  mcpCount: 'MCP: {n}',
  memoriesCount: 'Memories: {n}',
  projectsCount: 'Project files: {n}',
  syncNow: 'Sync now',
  syncing: 'Syncing…',
  clearAll: 'Clear imported chats',
  clearConfirm: 'Clear imported chats? Imported DSH sessions will be archived and detached from their workspaces.',
  clearing: 'Clearing…',
  syncFail: 'Sync failed: {err}',
  cleared: 'Imports cleared: {archived} sessions archived, {detached} detached from workspaces, {md} Markdown files deleted. You can now re-import selectively.',
  clearFail: 'Clear failed: {err}',
  deleted: 'Deleted and excluded from sync scope.',
  delFail: 'Delete failed: {err}',
  del: 'Delete',
  restored: 'Restored; the next sync will re-import it.',
  restoreFail: 'Restore failed: {err}',
  restore: 'Restore',
  initProblem: 'Init problem: {err}',
  recentErrors: 'Recent errors: {errs}',
  stateReadFail: 'State read failed: {err}',
  noSessions: 'No sessions match the current filters.',
  noSessionsProj: 'No sessions under the selected projects (or none selected / subagents hidden).',
  hintSessions: 'Click "Refresh inventory" to load the session list',
  hintMcp: 'Click "Refresh inventory" to load the MCP list',
  hintProjects: 'Click "Refresh inventory" to load the project list',
  kindUser: 'User',
  kindSub: 'Subagent',
  kindOther: 'Other',
  internal: '(internal) ',
  imported: 'Imported',
  excluded: 'Excluded',
  notImported: 'Not imported',
  notIncluded: 'Not included',
  manualFreq: 'Manual (no auto)',
  every5m: 'Every 5 minutes',
  every15m: 'Every 15 minutes',
  every30m: 'Every 30 minutes',
  hourly: 'Hourly',
  every6h: 'Every 6 hours',
  daily: 'Daily',
  manualOnly: 'Manual sync only',
  waitingNext: 'Waiting for next schedule',
  inProgress: 'In progress…',
  importedConversations: 'Imported Conversations',
  noImportedConversations: 'No imported conversations yet. They appear here after a sync.',
  continueInCodex: 'Continue in Codex',
  continuingInCodex: 'Registering with Codex…',
  continueInCodexFail: 'Could not register with Codex: {err}',
  bridgeMemory: 'Memory Import',
  memoryProvider: 'Supported memory types',
  memoryHint: 'Each one-way sync reads the selected sources. Sources are namespaced so files never overwrite each other. AGENTS.md remains a separate project instruction.',
  memoryBuiltin: 'Codex MEMORY.md / memories/*.md',
  memoryMcp: 'Bridge MCP persistent memory',
  memorySkill: 'Memory Skill (~/memory/**/*.md)',
  dshProjects: 'Batch Migration by Project',
  loadDshProjects: 'Load DSH projects',
  transferProject: 'Move to Codex',
  transferringProject: 'Moving…',
  transferredProject: 'Imported {count} conversations into Codex.',
}

const CODEX_SYNC_JSON_SCHEMA = { parse: (value) => value }
const CODEX_SYNC_JSON_CODEC = {
  mode: 'strict',
  typeSymbol: 'dsh-codex-migrate#JsonValue',
  schema: CODEX_SYNC_JSON_SCHEMA,
}
const CODEX_SYNC_REMOTE = {
  package: 'dsh-codex-migrate',
  descriptors: [
  'getState',
  'detectCodexDir',
  'listInventory',
  'getMcpPrompt',
  'deleteSession',
  'restoreSession',
  'clearAllSessions',
  'saveConfig',
  'syncNow',
  'listDshProjects',
  'importDshConversationToCodex',
  'importDshProjectToCodex',
  'acknowledgeBridgeNavigation',
  ].map((method) => ({
    id: 'dsh-codex-migrate#codexSync/' + method,
    service: 'codexSync',
    namespace: 'codexSync',
    method,
    invocation: { kind: 'direct' },
    parameters: [{
      name: 'args',
      wire: 'args',
      source: 'json',
      codec: CODEX_SYNC_JSON_CODEC,
    }],
    result: CODEX_SYNC_JSON_CODEC,
  })),
}

const inject = ['slots', 'locale', 'remote', 'timer', 'sessions']

function apply(ctx) {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => {
    try { return ctx.locale.register(NS, { zh, en }) } catch (err) { console.error('dsh-codex-migrate: locale register failed', err) }
    return () => {}
  }, 'codex-sync.locale')
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-codex-migrate'
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'codex-sync.styles')

  // Lazy, fault-tolerant remote resolution: the namespace service is created
  // by $mount; both lookup paths are tried per call so a timing gap can never
  // kill the panel registration.
  function getRemote() {
    const viaCtx = ctx.get('remote.codexSync')
    if (viaCtx !== undefined) return viaCtx
    const root = ctx.get('remote')
    const ns = root && root.namespaces ? root.namespaces.get('codexSync') : undefined
    return ns && ns.service ? ns.service : null
  }
  const h = React.createElement
  function errText(err) {
    return String(err && err.message ? err.message : err)
  }
  async function call(method, args) {
    const remote = getRemote()
    if (!remote) throw new Error('dsh-codex-migrate: remote.codexSync unavailable yet')
    const res = await remote[method](args || {})
    if (res && res.ok === false) throw new Error(res.error && res.error.message ? res.error.message : 'remote error')
    return res && res.value !== undefined ? res.value : res
  }

  function openCodexConversation(conversationId) {
    if (typeof conversationId !== 'string' || conversationId === '') throw new Error('Codex conversation was not created')
    window.location.assign(`codex://threads/${encodeURIComponent(conversationId)}`)
  }

  const openedDshHandoffs = new Set()
  ctx.effect(() => ctx.interval(() => {
    void call('getState', {}).then((snapshot) => {
      const conversations = snapshot?.bridge?.conversations || []
      const target = conversations.find((record) => record
        && typeof record.navigationRequestId === 'string'
        && record.navigationRequestId !== ''
        && typeof record.dshConversationId === 'string'
        && record.dshConversationId !== ''
        && Date.now() - Number(record.navigationRequestedAtMs || 0) < 120000)
      if (!target) return
      const navigationKey = target.navigationRequestId
      if (openedDshHandoffs.has(navigationKey)) return
      openedDshHandoffs.add(navigationKey)
      Promise.resolve(ctx.sessions.open(target.dshConversationId)).then(() => call('acknowledgeBridgeNavigation', {
        bridgeId: target.bridgeId,
        navigationRequestId: target.navigationRequestId,
      })).catch(() => { openedDshHandoffs.delete(navigationKey) })
    }).catch(() => {})
  }, 700), 'codex-sync.bridge-navigation')

  function ContinueInCodexAction({ sessionId }) {
    const [busy, setBusy] = React.useState(false)
    const [failure, setFailure] = React.useState('')
    const active = ctx.locale.getSnapshot().active
    const dict = active === 'zh' ? zh : en
    const label = busy ? dict.continuingInCodex : dict.continueInCodex
    async function onClick() {
      if (busy) return
      setBusy(true); setFailure('')
      try {
        const imported = await call('importDshConversationToCodex', { dshConversationId: sessionId })
        openCodexConversation(imported?.codexConversationId)
      } catch (err) { setFailure(errText(err)) } finally { setBusy(false) }
    }
    return h('button', {
        type: 'button', className: 'cxs-message-action', disabled: busy,
        title: failure || label, 'aria-label': failure ? dict.continueInCodexFail.replace('{err}', failure) : label,
        onClick,
      }, h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
        h('path', { d: CODEX_ICON_PATH }),
      ))
  }

  function useSyncData() {
    const [data, setData] = React.useState(null)
    const [error, setError] = React.useState(null)
    function reload() {
      call('getState', { locale: ctx.locale.getSnapshot().active }).then((value) => { setData(value); setError(null) })
        .catch((err) => setError(errText(err)))
    }
    React.useEffect(() => {
      reload()
      const stop = ctx.interval(() => { reload() }, 2500)
      return stop
    }, [])
    return { data, error, reload }
  }

  function kindLabel(kind, translate = t) {
    if (kind === 'user') return translate('kindUser')
    if (kind === 'subagent') return translate('kindSub')
    return translate('kindOther')
  }
  function statusText(st, translate = t) {
    if (!st) return translate('statusLoading')
    if (st.syncing) return translate('statusSyncing')
    const r = st.lastSyncResult
    if (!r) return translate('statusNotSynced')
    if (!r.ok) return translate('statusFail', { err: r.error ? r.error.message : 'sync failed' })
    const parts = []
    if (r.sessions) parts.push(translate('sessionsCount', r.sessions))
    if (r.dsh) parts.push(translate('dshCount', { imported: r.dsh.imported }) + (r.dsh.attached > 0 ? translate('dshAttached', { attached: r.dsh.attached }) : ''))
    if (r.mcp) parts.push(translate('mcpCount', { n: r.mcp.servers }))
    if (r.memories) parts.push(translate('memoriesCount', { n: r.memories.copied }))
    if (r.projects) parts.push(translate('projectsCount', { n: r.projects.copiedFiles }))
    const at = new Date(st.lastSyncAtMs)
    return '✅ ' + parts.join(' · ') + ' · ' + at.toLocaleString()
  }
  function nextText(st, cfg, translate = t) {
    if (!st) return ''
    if (st.syncing) return translate('inProgress')
    if (!cfg || !cfg.autoSync || !(cfg.syncIntervalMinutes > 0)) return translate('manualOnly')
    if (!st.nextSyncAtMs) return translate('waitingNext')
    return new Date(st.nextSyncAtMs).toLocaleString()
  }

  const FREQ_OPTIONS = [
    { v: 0, key: 'manualFreq' },
    { v: 5, key: 'every5m' },
    { v: 15, key: 'every15m' },
    { v: 30, key: 'every30m' },
    { v: 60, key: 'hourly' },
    { v: 360, key: 'every6h' },
    { v: 1440, key: 'daily' },
  ]

  function CodexSyncSettings() {
    const { data, error, reload } = useSyncData()
    const cfg = data && data.config ? data.config : null
    const st = data && data.status ? data.status : null
    const [draft, setDraft] = React.useState(null)
    const [busy, setBusy] = React.useState(null)
    const [message, setMessage] = React.useState(null)
    const [inventory, setInventory] = React.useState(null)
    const [dshProjects, setDshProjects] = React.useState([])
    const [showSubagents, setShowSubagents] = React.useState(false)
    const [mcpPrompt, setMcpPrompt] = React.useState(null)
    const activeLocale = React.useSyncExternalStore(
      (listener) => ctx.locale.subscribe(listener),
      () => ctx.locale.getSnapshot().active,
      () => 'en',
    )
    const selectedLanguage = draft?.language || cfg?.language || 'auto'
    const effectiveLanguage = selectedLanguage === 'auto' ? (activeLocale === 'zh' ? 'zh' : 'en') : selectedLanguage
    function t(key, params) {
      const dict = effectiveLanguage === 'zh' ? zh : en
      let value = dict[key] === undefined ? key : dict[key]
      if (params) value = value.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match)
      return value
    }
    const [sessionLimit, setSessionLimit] = React.useState(80)
    const [projectLimit, setProjectLimit] = React.useState(80)

    React.useEffect(() => {
      if (cfg && draft === null) {
        setDraft({
          codexDir: cfg.codexDir,
          outputDir: cfg.outputDir,
          language: cfg.language,
          syncIntervalMinutes: cfg.syncIntervalMinutes,
          autoSync: cfg.autoSync,
          includeSessions: cfg.includeSessions,
          includeArchived: cfg.includeArchived,
          includeMcp: cfg.includeMcp,
          includeMemories: cfg.includeMemories,
          includeMcpMemories: cfg.includeMcpMemories !== false,
          includeMemorySkill: cfg.includeMemorySkill !== false,
          includeAgentsMd: cfg.includeAgentsMd,
          includeProjectFiles: cfg.includeProjectFiles,
          importAsDshSessions: cfg.importAsDshSessions,
          includeUserSessions: cfg.includeUserSessions,
          includeSubagentSessions: cfg.includeSubagentSessions,
          includeUnknownSessions: cfg.includeUnknownSessions,
          sessionMode: cfg.sessionMode,
          selectedSessionIds: (cfg.selectedSessionIds || []).slice(),
          projectMode: cfg.projectMode,
          selectedProjects: (cfg.selectedProjects || []).slice(),
          mcpMode: cfg.mcpMode,
          selectedMcpNames: (cfg.selectedMcpNames || []).slice(),
          maxMessagesPerSession: cfg.maxMessagesPerSession,
          maxToolOutputChars: cfg.maxToolOutputChars,
          maxProjectFileBytes: cfg.maxProjectFileBytes,
        })
      }
    }, [cfg, draft])

    React.useEffect(() => {
      if (!cfg) return
      void loadDshProjects(false)
    }, [cfg?.codexDir])

    function updateField(field, value) {
      setDraft((prev) => { const next = Object.assign({}, prev || {}); next[field] = value; return next })
    }
    function toggleArray(field, value) {
      setDraft((prev) => {
        const next = Object.assign({}, prev || {})
        const arr = (next[field] || []).slice()
        const i = arr.indexOf(value)
        if (i >= 0) arr.splice(i, 1)
        else arr.push(value)
        next[field] = arr
        return next
      })
    }
    async function loadInventory(showMsg) {
      if (showMsg) setBusy('inv')
      try {
        const res = await call('listInventory', {})
        setInventory(res)
        if (showMsg) setMessage(res && res.ok ? t('inventoryRefreshed') : t('inventoryFail', { err: res && res.error ? res.error : 'unknown' }))
      } catch (err) {
        if (showMsg) setMessage(t('inventoryFail', { err: errText(err) }))
      } finally { if (showMsg) setBusy(null) }
    }
    async function loadDshProjects(showMsg) {
      if (showMsg) setBusy('dsh-projects')
      try {
        const result = await call('listDshProjects', {})
        setDshProjects(Array.isArray(result?.projects) ? result.projects : [])
      } catch (err) {
        if (showMsg) setMessage(t('inventoryFail', { err: errText(err) }))
      } finally { if (showMsg) setBusy(null) }
    }
    async function transferDshProject(projectKey) {
      setBusy('dsh-project:' + projectKey); setMessage(null)
      try {
        const result = await call('importDshProjectToCodex', { projectKey })
        setMessage(t('transferredProject', { count: result?.imported?.length || 0 }))
        if (result?.openUrl) window.location.assign(result.openUrl)
      } catch (err) { setMessage(t('continueInCodexFail', { err: errText(err) })) }
      finally { setBusy(null) }
    }
    async function doDetect() {
      setBusy('detect'); setMessage(null)
      try {
        const res = await call('detectCodexDir', {})
        if (res && res.found) { updateField('codexDir', res.found); setMessage(t('detected', { path: res.found })) }
        else setMessage(t('notDetected'))
        await loadInventory(false)
      } catch (err) { setMessage(t('detectFail', { err: errText(err) })) }
      finally { setBusy(null) }
    }
    async function doSave() {
      setBusy('save'); setMessage(null)
      try {
        await call('saveConfig', draft || {})
        setMessage(t('saved'))
        reload()
      } catch (err) { setMessage(t('saveFail', { err: errText(err) })) }
      finally { setBusy(null) }
    }
    async function doSync() {
      setBusy('sync'); setMessage(null)
      try {
        await call('saveConfig', draft || {})
        await call('syncNow', { trigger: 'manual' })
        reload()
        await loadInventory(false)
      } catch (err) { setMessage(t('syncFail', { err: errText(err) })) }
      finally { setBusy(null) }
    }
    async function doClearAll() {
      if (typeof window !== 'undefined' && !window.confirm(t('clearConfirm'))) return
      setBusy('clear'); setMessage(null)
      try {
        const res = await call('clearAllSessions', {})
        setMessage(res && res.ok ? t('cleared', { archived: res.archived, detached: res.detached, md: res.mdDeleted }) : t('clearFail', { err: '' }))
        reload()
        await loadInventory(false)
      } catch (err) { setMessage(t('clearFail', { err: errText(err) })) }
      finally { setBusy(null) }
    }
    async function doDeleteSession(id) {
      setBusy('del'); setMessage(null)
      try {
        const res = await call('deleteSession', { codexId: id })
        setMessage(res && res.ok ? t('deleted') : t('delFail', { err: res && res.message ? res.message : 'unknown' }))
        reload()
        await loadInventory(false)
      } catch (err) { setMessage(t('delFail', { err: errText(err) })) }
      finally { setBusy(null) }
    }
    async function doRestoreSession(id) {
      setBusy('restore'); setMessage(null)
      try {
        const res = await call('restoreSession', { codexId: id })
        setMessage(res && res.ok ? t('restored') : t('restoreFail', { err: res && res.message ? res.message : 'unknown' }))
        reload()
        await loadInventory(false)
      } catch (err) { setMessage(t('restoreFail', { err: errText(err) })) }
      finally { setBusy(null) }
    }
    async function doMcpPrompt() {
      setBusy('mcpP'); setMessage(null)
      try {
        const res = await call('getMcpPrompt', {})
        if (res && res.ok) { setMcpPrompt(res.prompt); setMessage(t('promptReady')) }
        else setMessage(res && res.error ? res.error : t('promptFail', { err: '' }))
      } catch (err) { setMessage(t('promptFail', { err: errText(err) })) }
      finally { setBusy(null) }
    }
    async function copyMcpPrompt() {
      if (!mcpPrompt) return
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(mcpPrompt)
          setMessage(t('copied'))
          return
        }
      } catch (err) { /* fallback */ }
      setMessage(t('copyUnavailable'))
    }

    if (!cfg || !draft) {
      return h('div', { className: 'cxs-wrap' }, h('div', { className: 'cxs-hint' }, t('statusLoading')))
    }

    const sessionModeSelected = draft.sessionMode === 'selected'
    const mcpModeSelected = draft.mcpMode === 'selected'
    const projectModeSelected = draft.projectMode === 'selected'

    let sessionList = null
    if (inventory && inventory.ok) {
      let visibleSessions = (inventory.sessions || []).slice()
      if (!showSubagents) visibleSessions = visibleSessions.filter((s) => s.kind !== 'subagent')
      if (projectModeSelected) {
        visibleSessions = visibleSessions.filter((s) => draft.selectedProjects.indexOf(s.project) >= 0)
      }
      const totalVisibleSessions = visibleSessions.length
      visibleSessions = visibleSessions.slice(0, sessionLimit)
      if (visibleSessions.length === 0) {
        sessionList = h('div', { className: 'cxs-hint' }, projectModeSelected ? t('noSessionsProj') : t('noSessions'))
      } else {
        sessionList = h('div', { className: 'cxs-list' }, visibleSessions.map((s) => h('div', { key: s.id, className: 'cxs-item' },
          h('input', { type: 'checkbox', disabled: !sessionModeSelected, checked: sessionModeSelected ? draft.selectedSessionIds.indexOf(s.id) >= 0 : (s.included && !s.excluded), onChange: () => toggleArray('selectedSessionIds', s.id) }),
          h('span', { className: 'cxs-badge kind' }, kindLabel(s.kind, t)),
          h('span', { className: 'meta' }, (s.projectName ? '【' + s.projectName + '】 ' : '') + (s.date || '') + ' · ' + (s.codexId || s.id).slice(0, 8) + ' · ' + (s.kind === 'subagent' ? t('internal') : '') + (s.title || '')),
          s.excluded ? h('span', { className: 'cxs-badge out' }, t('excluded')) : (s.imported ? h('span', { className: 'cxs-badge done' }, t('imported')) : (s.included ? h('span', { className: 'cxs-badge' }, t('notImported')) : h('span', { className: 'cxs-badge out' }, t('notIncluded')))),
          s.excluded ? h('button', { className: 'cxs-btn ghost sm', disabled: busy === 'restore', onClick: () => doRestoreSession(s.id) }, t('restore')) : (s.imported ? h('button', { className: 'cxs-btn ghost sm', disabled: busy === 'del', onClick: () => doDeleteSession(s.id) }, t('del')) : null),
        )).concat(totalVisibleSessions > visibleSessions.length ? [h('button', { key: 'more-sessions', className: 'cxs-btn ghost sm', onClick: () => setSessionLimit((value) => value + 80) }, `+ ${Math.min(80, totalVisibleSessions - visibleSessions.length)}`)] : []))
      }
    } else {
      sessionList = h('div', { className: 'cxs-hint' }, t('hintSessions'))
    }
    let mcpList = null
    if (mcpModeSelected) {
      if (inventory && inventory.ok) {
        mcpList = h('div', { className: 'cxs-list' }, (inventory.mcp || []).map((m) => h('label', { key: m.name, className: 'cxs-item' },
          h('input', { type: 'checkbox', checked: draft.selectedMcpNames.indexOf(m.name) >= 0, onChange: () => toggleArray('selectedMcpNames', m.name) }),
          h('span', { className: 'meta' }, m.name + ' — ' + (m.detail || '')),
        )))
      } else {
        mcpList = h('div', { className: 'cxs-hint' }, t('hintMcp'))
      }
    }
    let projectList = null
    if (inventory && inventory.ok) {
      const allProjects = inventory.projects || []
      const visibleProjects = allProjects.slice(0, projectLimit)
      projectList = h('div', { className: 'cxs-list' }, visibleProjects.map((p) => h('label', { key: p.key, className: 'cxs-item' },
        h('input', { type: 'checkbox', disabled: !projectModeSelected, checked: projectModeSelected ? draft.selectedProjects.indexOf(p.key) >= 0 : true, onChange: () => toggleArray('selectedProjects', p.key) }),
        h('span', { className: 'meta' }, p.name + ' · ' + p.sessionCount + ' ' + t('kindOther') + ' · ' + (p.path || '')),
      )).concat(allProjects.length > visibleProjects.length ? [h('button', { key: 'more-projects', className: 'cxs-btn ghost sm', onClick: () => setProjectLimit((value) => value + 80) }, `+ ${Math.min(80, allProjects.length - visibleProjects.length)}`)] : []))
    } else {
      projectList = h('div', { className: 'cxs-hint' }, t('hintProjects'))
    }
    const importedRecords = Array.isArray(data?.imports) ? data.imports : []
    const importedList = importedRecords.length === 0
      ? h('div', { className: 'cxs-hint' }, t('noImportedConversations'))
      : h('div', { className: 'cxs-imported' }, importedRecords.map((record) => h('div', { className: 'cxs-imported-row', key: record.id },
        h('div', { className: 'cxs-imported-copy' },
          h('span', { className: 'cxs-imported-title' }, record.title || record.codexId),
          h('span', { className: 'cxs-hint' }, `${record.projectName || '(no project)'} · ${record.date || ''}`),
        ),
        h('span', { className: 'cxs-badge done' }, t('imported')),
      )))

    return h('div', { className: 'cxs-wrap' },
      h('div', { className: 'cxs-card' },
        h('h3', null, t('dataSource')),
        h('div', { className: 'cxs-row' },
          h('label', null, t('codexDir')),
          h('input', { className: 'cxs-input', value: draft.codexDir, placeholder: t('codexDirPlaceholder'), onChange: (e) => updateField('codexDir', e.target.value) }),
          h('button', { className: 'cxs-btn ghost', disabled: busy === 'detect', onClick: doDetect }, busy === 'detect' ? t('detecting') : t('autoDetect')),
        ),
        h('div', { className: 'cxs-row' },
          h('label', null, t('outputDir')),
          h('input', { className: 'cxs-input', value: draft.outputDir, placeholder: t('outDirPlaceholder'), onChange: (e) => updateField('outputDir', e.target.value) }),
        ),
        h('div', { className: 'cxs-hint' }, data && data.outRoot ? t('currentOut', { path: data.outRoot }) : ''),
        h('div', { className: 'cxs-row' },
          h('label', null, t('languageLabel')),
          h('select', { className: 'cxs-select', value: String(draft.language || 'auto'), onChange: (e) => updateField('language', e.target.value) },
            h('option', { value: 'en' }, 'English'),
            h('option', { value: 'zh' }, '中文'),
            h('option', { value: 'auto' }, 'Auto (UI)'),
          ),
        ),
      ),
      h('div', { className: 'cxs-card' },
        h('h3', null, t('schedule')),
        h('div', { className: 'cxs-row spread' },
          h('label', null, t('freq')),
          h('select', { className: 'cxs-select', value: String(draft.syncIntervalMinutes), onChange: (e) => updateField('syncIntervalMinutes', Number(e.target.value)) },
            FREQ_OPTIONS.map((o) => h('option', { key: o.v, value: String(o.v) }, t(o.key))),
          ),
        ),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.autoSync, onChange: (e) => updateField('autoSync', e.target.checked) }),
          h('span', null, t('autoSync')),
        ),
        h('div', { className: 'cxs-row spread' },
          h('span', { className: 'cxs-hint' }, t('nextSync')),
          h('span', { className: 'cxs-hint' }, nextText(st, draft, t)),
        ),
        h('div', { className: 'cxs-row' },
          h('button', { className: 'cxs-btn', disabled: busy === 'save', onClick: doSave }, busy === 'save' ? t('saving') : t('save')),
        ),
      ),
      h('div', { className: 'cxs-card' },
        h('h3', null, t('contents')),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.includeSessions, onChange: (e) => updateField('includeSessions', e.target.checked) }),
          h('span', null, t('sessionsHistory')),
        ),
        h('div', { className: 'cxs-row' },
          h('span', { className: 'cxs-hint' }, t('kinds')),
          h('label', null,
            h('input', { type: 'checkbox', checked: draft.includeUserSessions, onChange: (e) => updateField('includeUserSessions', e.target.checked) }),
            h('span', null, t('userKind')),
          ),
          h('label', null,
            h('input', { type: 'checkbox', checked: draft.includeSubagentSessions, onChange: (e) => updateField('includeSubagentSessions', e.target.checked) }),
            h('span', null, t('subKind')),
          ),
          h('label', null,
            h('input', { type: 'checkbox', checked: draft.includeUnknownSessions, onChange: (e) => updateField('includeUnknownSessions', e.target.checked) }),
            h('span', null, t('otherKind')),
          ),
        ),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.importAsDshSessions, onChange: (e) => updateField('importAsDshSessions', e.target.checked) }),
          h('span', null, t('importDsh')),
        ),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.includeArchived, onChange: (e) => updateField('includeArchived', e.target.checked) }),
          h('span', null, t('includeArchived')),
        ),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.includeMcp, onChange: (e) => updateField('includeMcp', e.target.checked) }),
          h('span', null, t('includeMcp')),
        ),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.includeAgentsMd, onChange: (e) => updateField('includeAgentsMd', e.target.checked) }),
          h('span', null, t('includeAgentsMd')),
        ),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.includeProjectFiles, onChange: (e) => updateField('includeProjectFiles', e.target.checked) }),
          h('span', null, t('includeProjectFiles')),
        ),
        h('div', { className: 'cxs-row spread' },
          h('label', null, t('maxFileKB')),
          h('input', { className: 'cxs-num', type: 'number', min: 1, value: String(Math.round(draft.maxProjectFileBytes / 1024)), onChange: (e) => updateField('maxProjectFileBytes', Math.max(1, Math.round(Number(e.target.value) * 1024))) }),
        ),
      ),
      h('div', { className: 'cxs-card' },
        h('h3', null, t('projectScope')),
        h('div', { className: 'cxs-row' },
          h('label', null,
            h('input', { type: 'radio', name: 'cxs-project-mode', checked: draft.projectMode === 'all', onChange: () => updateField('projectMode', 'all') }),
            h('span', null, t('allProjects')),
          ),
          h('label', null,
            h('input', { type: 'radio', name: 'cxs-project-mode', checked: projectModeSelected, onChange: () => updateField('projectMode', 'selected') }),
            h('span', null, t('manualSelect')),
          ),
        ),
        h('div', { className: 'cxs-row' },
          h('button', { className: 'cxs-btn ghost', disabled: busy === 'inv', onClick: () => loadInventory(true) }, busy === 'inv' ? t('loadingInventory') : t('refreshInventory')),
        ),
        projectList,
      ),
      h('div', { className: 'cxs-card' },
        h('h3', null, t('sessionScope')),
        h('div', { className: 'cxs-row' },
          h('label', null,
            h('input', { type: 'radio', name: 'cxs-session-mode', checked: draft.sessionMode === 'all', onChange: () => updateField('sessionMode', 'all') }),
            h('span', null, t('allInProject')),
          ),
          h('label', null,
            h('input', { type: 'radio', name: 'cxs-session-mode', checked: draft.sessionMode === 'new', onChange: () => updateField('sessionMode', 'new') }),
            h('span', null, t('newOnly')),
          ),
          h('label', null,
            h('input', { type: 'radio', name: 'cxs-session-mode', checked: sessionModeSelected, onChange: () => updateField('sessionMode', 'selected') }),
            h('span', null, t('manualSelect')),
          ),
        ),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: showSubagents, onChange: (e) => setShowSubagents(e.target.checked) }),
          h('span', null, t('showSubagents')),
        ),
        sessionList,
      ),
      h('div', { className: 'cxs-card' },
        h('h3', null, t('mcpScope')),
        h('div', { className: 'cxs-row' },
          h('label', null,
            h('input', { type: 'radio', name: 'cxs-mcp-mode', checked: draft.mcpMode === 'all', onChange: () => updateField('mcpMode', 'all') }),
            h('span', null, t('allServers')),
          ),
          h('label', null,
            h('input', { type: 'radio', name: 'cxs-mcp-mode', checked: mcpModeSelected, onChange: () => updateField('mcpMode', 'selected') }),
            h('span', null, t('manualSelect')),
          ),
        ),
        mcpList,
        h('div', { className: 'cxs-row' },
          h('button', { className: 'cxs-btn ghost', disabled: busy === 'mcpP', onClick: () => { void doMcpPrompt() } }, busy === 'mcpP' ? t('fetching') : t('getPrompt')),
          mcpPrompt ? h('button', { className: 'cxs-btn ghost', onClick: () => { void copyMcpPrompt() } }, t('copyPrompt')) : null,
        ),
        mcpPrompt ? h('pre', { className: 'cxs-msg', style: { maxHeight: '220px', overflowY: 'auto', background: 'var(--dsw-alias-bg-layer-2)', padding: '8px 10px', borderRadius: '8px', color: 'var(--dsw-alias-label-primary)' } }, mcpPrompt) : null,
      ),
      h('div', { className: 'cxs-card' },
        h('h3', null, t('importedConversations')),
        importedList,
      ),
      h('div', { className: 'cxs-card' },
        h('h3', null, t('dshProjects')),
        h('div', { className: 'cxs-row' },
          h('button', { className: 'cxs-btn ghost', disabled: busy === 'dsh-projects', onClick: () => loadDshProjects(true) }, busy === 'dsh-projects' ? t('loadingInventory') : t('loadDshProjects')),
        ),
        dshProjects.length === 0 ? h('div', { className: 'cxs-hint' }, t('hintProjects')) : h('div', { className: 'cxs-list' }, dshProjects.map((project) => h('div', { className: 'cxs-item', key: project.key },
          h('span', { className: 'meta' }, `${project.name} · ${project.sessionCount} · ${project.path || ''}`),
          h('button', { className: 'cxs-btn ghost sm', disabled: busy === 'dsh-project:' + project.key, onClick: () => transferDshProject(project.key) }, busy === 'dsh-project:' + project.key ? t('transferringProject') : t('transferProject')),
        ))),
      ),
      h('div', { className: 'cxs-card' },
        h('h3', null, t('bridgeMemory')),
        h('div', { className: 'cxs-hint', style: { marginBottom: '6px' } }, t('memoryProvider')),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.includeMemories, onChange: (e) => updateField('includeMemories', e.target.checked) }),
          h('span', null, t('memoryBuiltin')),
        ),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.includeMcpMemories, onChange: (e) => updateField('includeMcpMemories', e.target.checked) }),
          h('span', null, t('memoryMcp')),
          h('span', { className: 'cxs-badge kind' }, 'Beta'),
        ),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.includeMemorySkill, onChange: (e) => updateField('includeMemorySkill', e.target.checked) }),
          h('span', null, t('memorySkill')),
        ),
        h('div', { className: 'cxs-hint' }, t('memoryHint')),
      ),
      h('div', { className: 'cxs-card' },
        h('h3', null, t('status')),
        h('div', { className: 'cxs-status' }, statusText(st, t)),
        data && data.initLog && !data.initLog.ok ? h('div', { className: 'cxs-err' }, t('initProblem', { err: data.initLog.error || 'unknown' })) : null,
        data && data.lastErrors && data.lastErrors.length > 0 ? h('div', { className: 'cxs-err' }, t('recentErrors', { errs: data.lastErrors.slice(0, 3).map((e) => e.path + ' ' + e.code).join(' | ') })) : null,
        h('div', { className: 'cxs-row' },
          h('button', { className: 'cxs-btn', disabled: busy === 'sync' || (st && st.syncing), onClick: doSync }, (busy === 'sync' || (st && st.syncing)) ? t('syncing') : t('syncNow')),
          h('button', { className: 'cxs-btn ghost', disabled: busy === 'clear', onClick: doClearAll }, busy === 'clear' ? t('clearing') : t('clearAll')),
        ),
      ),
      message ? h('pre', { className: 'cxs-msg' }, message) : null,
      error ? h('div', { className: 'cxs-err' }, t('stateReadFail', { err: error })) : null,
    )
  }

  function finishMount() {
    ctx.slots.inject('conversation.chat.assistant-actions', () => {
      try {
        return ctx.slots.register({
          name: 'conversation.chat.assistant-actions',
          id: 'continue-in-codex',
          order: 20,
          label: () => t('continueInCodex'),
          locale: NS,
        }, ContinueInCodexAction)
      } catch (err) {
        console.error('dsh-codex-migrate: assistant action registration failed', err)
        return () => {}
      }
    })
    ctx.slots.inject('settings.section', () => {
      try {
        return ctx.slots.register(
          {
            name: 'settings.section',
            id: 'codex-sync',
            order: 30,
            label: () => t('nav'),
            locale: NS,
          },
          () => h(CodexSyncSettings),
        )
      } catch (err) {
        console.error('dsh-codex-migrate: settings.section registration failed', err)
        return () => {}
      }
    })
  }
  ctx.remote.$mount(CODEX_SYNC_REMOTE).then(
    () => { finishMount() },
    (err) => { console.error('dsh-codex-migrate: $mount failed', err); finishMount() },
  )
}

exports.apply = apply
exports.inject = inject
