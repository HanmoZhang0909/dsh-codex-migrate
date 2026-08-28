// dsh-codex-migrate — host half.
// Migrates Codex CLI conversations, MCP servers, memories and project files
// into DeepSeek Harness sessions, workspaces and MCP registrations.
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { createLogic } from './logic.js'
import { startBridgeServer } from './bridge-server.js'
import os from 'node:os'
import { join } from 'node:path'

export const name = 'dsh-codex-migrate'

// Hard dependencies: declaring them makes Cordis keep this plugin waiting
// until the services are actually available — `ctx.get` during apply is
// otherwise racy at boot (observed: sessionPersistence not yet mounted).
const inject = ['timer', 'tools', 'sessionPersistence', 'workspaceRegistry']

/**
 * Manual equivalent of the `@Remote("method")` decorator:
 * Typert's Remote decorator only records a private WeakMap marker through the
 * stage-3 `context.addInitializer` hook; Node (without a build step) does not
 * parse decorator syntax, so we feed the decorator factory the same context
 * shape directly. Idempotent per method.
 */
function markRemote(instance, method) {
  Remote(method)(undefined, {
    kind: 'method',
    name: method,
    static: false,
    private: false,
    addInitializer: (fn) => { fn.call(instance) },
  })
}

class CodexSyncService extends TypertRemoteService {
  constructor(ctx, logic) {
    super(ctx, 'codexSync')
    this.logic = logic
    markRemote(this, 'getState')
    markRemote(this, 'detectCodexDir')
    markRemote(this, 'listInventory')
    markRemote(this, 'getMcpPrompt')
    markRemote(this, 'deleteSession')
    markRemote(this, 'restoreSession')
    markRemote(this, 'clearAllSessions')
    markRemote(this, 'saveConfig')
    markRemote(this, 'syncNow')
    markRemote(this, 'listDshProjects')
    markRemote(this, 'importDshConversationToCodex')
    markRemote(this, 'importDshProjectToCodex')
    markRemote(this, 'acknowledgeBridgeNavigation')
  }
  getState(args) { return this.logic.getState(args) }
  detectCodexDir(args) { return this.logic.detectCodexDir(args) }
  listInventory(args) { return this.logic.listInventory(args) }
  getMcpPrompt(args) { return this.logic.getMcpPrompt(args) }
  deleteSession(args) { return this.logic.deleteSession(args) }
  restoreSession(args) { return this.logic.restoreSession(args) }
  clearAllSessions(args) { return this.logic.clearAllSessions(args) }
  saveConfig(args) { return this.logic.saveConfig(args) }
  syncNow(args) { return this.logic.syncNow(args) }
  listDshProjects(args) { return this.logic.listDshProjects(args) }
  importDshConversationToCodex(args) { return this.logic.importDshConversationToCodex(args) }
  importDshProjectToCodex(args) { return this.logic.importDshProjectToCodex(args) }
  getBridgeConversation(args) { return this.logic.getBridgeConversation(args) }
  getBridgeRegistrationContext(args) { return this.logic.getBridgeRegistrationContext(args) }
  registerBridgeConversation(args) { return this.logic.registerBridgeConversation(args) }
  registerBridgeScope(args) { return this.logic.registerBridgeScope(args) }
  observeBridgeConversation(args) { return this.logic.observeBridgeConversation(args) }
  continueBridgeConversation(args) { return this.logic.continueBridgeConversation(args) }
  updateBridgeConversation(args) { return this.logic.updateBridgeConversation(args) }
  takeOverBridgeConversation(args) { return this.logic.takeOverBridgeConversation(args) }
  sendBridgeMessage(args) { return this.logic.sendBridgeMessage(args) }
  syncBridgeConversation(args) { return this.logic.syncBridgeConversation(args) }
  continueBridgeInCodex(args) { return this.logic.continueBridgeInCodex(args) }
  requestBridgeNavigation(args) { return this.logic.requestBridgeNavigation(args) }
  acknowledgeBridgeNavigation(args) { return this.logic.acknowledgeBridgeNavigation(args) }
  unshareBridgeConversation(args) { return this.logic.unshareBridgeConversation(args) }
  acquireBridgeLease(args) { return this.logic.acquireBridgeLease(args) }
  heartbeatBridgeLease(args) { return this.logic.heartbeatBridgeLease(args) }
  releaseBridgeLease(args) { return this.logic.releaseBridgeLease(args) }
  detectBridgeConflict(args) { return this.logic.detectBridgeConflict(args) }
  resolveBridgeConflict(args) { return this.logic.resolveBridgeConflict(args) }
  createBridgeBranch(args) { return this.logic.createBridgeBranch(args) }
  archiveBridgeConversation(args) { return this.logic.archiveBridgeConversation(args) }
}

const TOOL = {
  name: 'codex_sync',
  description: 'Manage Codex migration: sync runs one migration pass, status shows config and the latest sync result, clear removes all imported chats (archives them and detaches from workspaces; re-import selectively afterwards).',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['sync', 'status', 'clear'],
        description: 'sync runs one migration pass now; status returns the current config and latest sync result; clear removes all imported chats.',
      },
    },
    required: ['action'],
  },
  output: {
    schema: { type: 'object', additionalProperties: true },
    render(args, value) {
      return [{ type: 'text', text: typeof value.summary === 'string' ? value.summary : JSON.stringify(value) }]
    },
  },
}

async function apply(ctx, config) {
  const home = resolveDshHome()
  const logic = createLogic(ctx, config, home)
  new CodexSyncService(ctx, logic)

  const toolDef = Object.assign({}, TOOL, {
    execute(args, exec) {
      return logic.toolExecute(args)
    },
  })
  ctx.effect(() => ctx.tools.register(toolDef), 'tool.codex_sync')

  ctx.effect(() => () => logic.dispose(), 'codex-sync.cleanup')

  let bridgeServer = null
  let disposed = false
  ctx.effect(() => () => {
    disposed = true
    if (bridgeServer !== null) bridgeServer.dispose()
  }, 'codex-sync.bridge-cleanup')

  void logic.init().then(() => {
    if (disposed) return
    const current = logic.getState({}).config
    bridgeServer = startBridgeServer({
      enabled: current.bridgeEnabled,
      port: current.bridgePort,
      logic,
      tokenPath: join(os.homedir(), '.codex', 'dsh-codex-bridge', 'install-token'),
      onError(error) {
        console.warn('dsh-codex-migrate: bridge server:', error.message)
      },
    })
  }).catch((error) => {
    console.warn('dsh-codex-migrate: bridge startup skipped:', error.message)
  })
}

export { apply, inject }
