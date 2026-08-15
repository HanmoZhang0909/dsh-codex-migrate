const React = require('react')

const CSS = `
.cxs-wrap { display: flex; flex-direction: column; gap: 12px; padding: 2px 0 32px; font-size: 13px; line-height: 1.5; }
.cxs-card { background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px; padding: 14px 16px; }
.cxs-card h3 { margin: 0 0 10px; font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.cxs-row { display: flex; align-items: center; gap: 10px; padding: 5px 0; flex-wrap: wrap; }
.cxs-row.spread { justify-content: space-between; }
.cxs-row label, .cxs-row span { color: var(--dsw-alias-label-primary); }
.cxs-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.cxs-input { flex: 1; min-width: 220px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 6px 10px; font-size: 12px; outline: none; }
.cxs-select { background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 6px 8px; font-size: 12px; }
.cxs-num { width: 110px; background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 6px 8px; font-size: 12px; }
.cxs-btn { background: var(--dsw-alias-brand-primary); color: #ffffff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
.cxs-btn:hover { opacity: 0.9; }
.cxs-btn:disabled { opacity: 0.55; cursor: default; }
.cxs-btn.ghost { background: transparent; border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.cxs-btn.sm { padding: 2px 8px; font-size: 11px; font-weight: 500; border-radius: 6px; }
.cxs-status { padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 12px; word-break: break-all; }
.cxs-msg { color: var(--dsw-alias-state-success-primary); font-size: 12px; white-space: pre-wrap; word-break: break-all; }
.cxs-err { color: var(--dsw-alias-state-error-primary); font-size: 12px; word-break: break-all; }
.cxs-list { max-height: 240px; overflow-y: auto; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; padding: 6px 8px; background: var(--dsw-alias-bg-layer-2); display: flex; flex-direction: column; gap: 4px; }
.cxs-item { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--dsw-alias-label-primary); }
.cxs-item .meta { color: var(--dsw-alias-label-secondary); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.cxs-badge { font-size: 10px; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.cxs-badge.done { color: var(--dsw-alias-state-success-primary); border-color: var(--dsw-alias-state-success-primary); }
.cxs-badge.out { color: var(--dsw-alias-state-warn-primary); border-color: var(--dsw-alias-state-warn-primary); }
.cxs-badge.kind { color: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
`

const NS = 'codex-sync'

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

const inject = ['slots', 'locale', 'remote', 'timer']

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

  function kindLabel(kind) {
    if (kind === 'user') return t('kindUser')
    if (kind === 'subagent') return t('kindSub')
    return t('kindOther')
  }
  function statusText(st) {
    if (!st) return t('statusLoading')
    if (st.syncing) return t('statusSyncing')
    const r = st.lastSyncResult
    if (!r) return t('statusNotSynced')
    if (!r.ok) return t('statusFail', { err: r.error ? r.error.message : 'sync failed' })
    const parts = []
    if (r.sessions) parts.push(t('sessionsCount', r.sessions))
    if (r.dsh) parts.push(t('dshCount', { imported: r.dsh.imported }) + (r.dsh.attached > 0 ? t('dshAttached', { attached: r.dsh.attached }) : ''))
    if (r.mcp) parts.push(t('mcpCount', { n: r.mcp.servers }))
    if (r.memories) parts.push(t('memoriesCount', { n: r.memories.copied }))
    if (r.projects) parts.push(t('projectsCount', { n: r.projects.copiedFiles }))
    const at = new Date(st.lastSyncAtMs)
    return '✅ ' + parts.join(' · ') + ' · ' + at.toLocaleString()
  }
  function nextText(st, cfg) {
    if (!st) return ''
    if (st.syncing) return t('inProgress')
    if (!cfg || !cfg.autoSync || !(cfg.syncIntervalMinutes > 0)) return t('manualOnly')
    if (!st.nextSyncAtMs) return t('waitingNext')
    return new Date(st.nextSyncAtMs).toLocaleString()
  }

  const FREQ_OPTIONS = [
    { v: 0, label: () => t('manualFreq') },
    { v: 5, label: () => t('every5m') },
    { v: 15, label: () => t('every15m') },
    { v: 30, label: () => t('every30m') },
    { v: 60, label: () => t('hourly') },
    { v: 360, label: () => t('every6h') },
    { v: 1440, label: () => t('daily') },
  ]

  function CodexSyncSettings() {
    const { data, error, reload } = useSyncData()
    const cfg = data && data.config ? data.config : null
    const st = data && data.status ? data.status : null
    const [draft, setDraft] = React.useState(null)
    const [busy, setBusy] = React.useState(null)
    const [message, setMessage] = React.useState(null)
    const [inventory, setInventory] = React.useState(null)
    const [showSubagents, setShowSubagents] = React.useState(false)
    const [mcpPrompt, setMcpPrompt] = React.useState(null)

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
      try {
        const res = await call('listInventory', {})
        setInventory(res)
        if (showMsg) setMessage(res && res.ok ? t('inventoryRefreshed') : t('inventoryFail', { err: res && res.error ? res.error : 'unknown' }))
      } catch (err) {
        if (showMsg) setMessage(t('inventoryFail', { err: errText(err) }))
      }
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
      if (visibleSessions.length === 0) {
        sessionList = h('div', { className: 'cxs-hint' }, projectModeSelected ? t('noSessionsProj') : t('noSessions'))
      } else {
        sessionList = h('div', { className: 'cxs-list' }, visibleSessions.map((s) => h('div', { key: s.id, className: 'cxs-item' },
          h('input', { type: 'checkbox', disabled: !sessionModeSelected, checked: sessionModeSelected ? draft.selectedSessionIds.indexOf(s.id) >= 0 : (s.included && !s.excluded), onChange: () => toggleArray('selectedSessionIds', s.id) }),
          h('span', { className: 'cxs-badge kind' }, kindLabel(s.kind)),
          h('span', { className: 'meta' }, (s.projectName ? '【' + s.projectName + '】 ' : '') + (s.date || '') + ' · ' + (s.codexId || s.id).slice(0, 8) + ' · ' + (s.kind === 'subagent' ? t('internal') : '') + (s.title || '')),
          s.excluded ? h('span', { className: 'cxs-badge out' }, t('excluded')) : (s.imported ? h('span', { className: 'cxs-badge done' }, t('imported')) : (s.included ? h('span', { className: 'cxs-badge' }, t('notImported')) : h('span', { className: 'cxs-badge out' }, t('notIncluded')))),
          s.excluded ? h('button', { className: 'cxs-btn ghost sm', disabled: busy === 'restore', onClick: () => doRestoreSession(s.id) }, t('restore')) : (s.imported ? h('button', { className: 'cxs-btn ghost sm', disabled: busy === 'del', onClick: () => doDeleteSession(s.id) }, t('del')) : null),
        )))
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
      projectList = h('div', { className: 'cxs-list' }, (inventory.projects || []).map((p) => h('label', { key: p.key, className: 'cxs-item' },
        h('input', { type: 'checkbox', disabled: !projectModeSelected, checked: projectModeSelected ? draft.selectedProjects.indexOf(p.key) >= 0 : true, onChange: () => toggleArray('selectedProjects', p.key) }),
        h('span', { className: 'meta' }, p.name + ' · ' + p.sessionCount + ' ' + t('kindOther') + ' · ' + (p.path || '')),
      )))
    } else {
      projectList = h('div', { className: 'cxs-hint' }, t('hintProjects'))
    }

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
          h('label', null, 'Language'),
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
            FREQ_OPTIONS.map((o) => h('option', { key: o.v, value: String(o.v) }, o.label())),
          ),
        ),
        h('label', { className: 'cxs-row' },
          h('input', { type: 'checkbox', checked: draft.autoSync, onChange: (e) => updateField('autoSync', e.target.checked) }),
          h('span', null, t('autoSync')),
        ),
        h('div', { className: 'cxs-row spread' },
          h('span', { className: 'cxs-hint' }, t('nextSync')),
          h('span', { className: 'cxs-hint' }, nextText(st, draft)),
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
          h('input', { type: 'checkbox', checked: draft.includeMemories, onChange: (e) => updateField('includeMemories', e.target.checked) }),
          h('span', null, t('includeMemories')),
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
        h('h3', null, t('status')),
        h('div', { className: 'cxs-status' }, statusText(st)),
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
