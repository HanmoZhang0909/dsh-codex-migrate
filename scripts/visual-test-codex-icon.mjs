import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const output = join(root, 'docs', 'preview')
mkdirSync(output, { recursive: true })

const nodeModules = process.env.CODEX_WORKSPACE_NODE_MODULES
if (!nodeModules) throw new Error('Set CODEX_WORKSPACE_NODE_MODULES to the bundled node_modules directory.')
const require = createRequire(join(nodeModules, 'package.json'))
const { chromium } = require('playwright')
const svg = readFileSync(join(root, 'codex', 'dsh-codex-bridge', 'assets', 'codex.svg'), 'utf8')

const icon = (size) => `<div class="sample"><div class="button icon-${size}">${svg}</div><span>${size}px</span></div>`
const html = `<!doctype html><html><head><style>
  * { box-sizing: border-box }
  body { margin: 0; width: 420px; height: 190px; display: grid; place-items: center; background: #171717; color: #a3a3a3; font: 12px ui-sans-serif, system-ui; }
  main { display: flex; align-items: end; gap: 28px; padding: 28px; border: 1px solid #2f2f2f; border-radius: 18px; background: #202020; }
  .sample { display: grid; justify-items: center; gap: 9px }
  .button { width: 32px; height: 32px; display: grid; place-items: center; color: #b4b4b4; border-radius: 999px; }
  .button:hover { background: #2f2f2f; color: #ececec }
  .button svg { width: var(--size); height: var(--size); }
  .icon-16 { --size: 16px }.icon-20 { --size: 20px }.icon-24 { --size: 24px }
</style></head><body><main>${icon(16)}${icon(20)}${icon(24)}</main></body></html>`

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 190 }, colorScheme: 'dark' })
  await page.setContent(html, { waitUntil: 'load' })
  await page.screenshot({ path: join(output, 'codex-icon-sizes.png') })
} finally {
  await browser.close()
}

console.log(join(output, 'codex-icon-sizes.png'))
