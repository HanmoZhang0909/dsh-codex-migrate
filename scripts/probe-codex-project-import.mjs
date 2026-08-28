import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCodexAppServer } from '../lib/bridge/codex-app-server.js'

const root = mkdtempSync(join(tmpdir(), 'dsh-codex-project-probe-'))
const codexHome = join(root, '.codex')
const workspace = join(root, 'original-dsh-project')
mkdirSync(codexHome, { recursive: true })
mkdirSync(workspace, { recursive: true })
process.env.CODEX_HOME = codexHome

try {
  const client = createCodexAppServer({ timeoutMs: 30000 })
  const created = await client.createProjectThreads({
    workspace,
    title: '原 DSH 项目',
    sessions: [
      { title: 'DSH 项目对话一', transcript: [{ role: 'user', content: [{ type: 'text', text: '项目问题一' }] }] },
      { title: 'DSH 项目对话二', transcript: [{ role: 'user', content: [{ type: 'text', text: '项目问题二' }] }] },
    ],
  })
  assert.equal(created.length, 2)
  assert.notEqual(created[0].id, created[1].id)
  const threads = await Promise.all(created.map((item) => client.readThread(item.id)))
  assert.deepEqual(threads.map((item) => item?.thread?.cwd), [workspace, workspace])
  assert.deepEqual(created.map((item) => item.projectId), [null, null])
  console.log(JSON.stringify({
    ok: true,
    projectPath: workspace,
    taskIds: created.map((item) => item.id),
    taskCwds: threads.map((item) => item?.thread?.cwd),
  }))
} finally {
  rmSync(root, { recursive: true, force: true })
}
