// Zero-dependency client bundler: wraps src/client/index.js into the
// window.__ModuleLoader__.load form the dsh web shell consumes.
// Runtime requires (react, @deepseek-ai/...) are resolved by the loader's
// injected module table, so no dependency bundling is needed here.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = readFileSync(join(root, 'src', 'client', 'index.js'), 'utf8')
const outDir = join(root, 'lib')
mkdirSync(outDir, { recursive: true })

const bundle = `window.__ModuleLoader__.load({
  id: "dsh-codex-migrate",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${src}
    return module.exports;
  }
});
`
writeFileSync(join(outDir, 'client.js'), bundle)
console.log(`built lib/client.js (${bundle.length} chars)`)
