// dsh-codex-migrate — host half.
// Migrates Codex CLI conversations, MCP servers, memories and project files
// into DeepSeek Harness sessions, workspaces and MCP registrations.
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { createLogic } from './logic.js'

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

  void logic.init()
}

export { apply, inject }
