import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const nodeModules = process.env.CODEX_WORKSPACE_NODE_MODULES
if (!nodeModules) throw new Error('Set CODEX_WORKSPACE_NODE_MODULES to the bundled node_modules directory.')
const require = createRequire(join(nodeModules, 'package.json'))
const { chromium } = require('playwright')

const baseUrl = process.env.DSH_PREVIEW_URL || 'http://127.0.0.1:4174'
const outputDir = join(process.cwd(), 'docs', 'preview')
mkdirSync(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 })
  await page.screenshot({ path: join(outputDir, 'dsh-home.png'), fullPage: true })
  const settingsButton = page.getByText(/^(设置|Settings)$/).first()
  if (await settingsButton.count()) {
    await settingsButton.click()
    await page.waitForTimeout(300)
    const pluginEntry = page.getByText(/^(Codex 迁移|Codex Migration)$/).first()
    if (await pluginEntry.count()) {
      await pluginEntry.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: join(outputDir, 'dsh-codex-settings-default.png'), fullPage: true })
      const englishOption = page.locator('select').filter({ has: page.locator('option[value="en"]') }).first()
      if (await englishOption.count()) {
        await englishOption.selectOption('zh')
        await page.waitForTimeout(250)
        await page.screenshot({ path: join(outputDir, 'dsh-codex-settings-zh.png'), fullPage: true })
        const memoryHeading = page.getByText('记忆导入', { exact: true })
        if (await memoryHeading.count()) {
          const loadProjects = page.getByText('读取 DSH 项目', { exact: true })
          if (await loadProjects.count()) {
            await loadProjects.click()
            await page.waitForTimeout(5000)
          }
          await memoryHeading.scrollIntoViewIfNeeded()
          await page.waitForTimeout(150)
          await page.screenshot({ path: join(outputDir, 'dsh-codex-settings-memory-zh.png') })
        }
        await englishOption.selectOption('en')
        await page.waitForTimeout(250)
        await page.screenshot({ path: join(outputDir, 'dsh-codex-settings-en.png'), fullPage: true })
      }
    } else {
      const pluginsTab = page.getByText(/^(插件|Plugins)$/).first()
      if (await pluginsTab.count()) {
        await pluginsTab.click()
        await page.waitForTimeout(500)
        await page.screenshot({ path: join(outputDir, 'dsh-plugins.png'), fullPage: true })
      }
    }
  }
  const controls = await page.locator('button, [role="button"], a').evaluateAll((nodes) => nodes.slice(0, 80).map((node) => ({
    text: (node.textContent || '').trim().slice(0, 80),
    label: node.getAttribute('aria-label') || node.getAttribute('title') || '',
  })))
  process.stdout.write(JSON.stringify({
    url: page.url(), title: await page.title(), controls, errors,
    pluginVisible: await page.getByText(/^(Codex 迁移|Codex Migration)$/).count(),
    bodyText: (await page.locator('body').innerText()).slice(0, 3000),
  }, null, 2) + '\n')
} finally {
  await browser.close()
}
