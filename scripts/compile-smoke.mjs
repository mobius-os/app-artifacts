// Compile-smoke index.jsx the way Möbius actually installs it: Rolldown, browser
// platform, and every bare import left external because the shell supplies those
// through its import map. Rolldown comes from the shell's frontend — the same
// place the tests get it — so this app pins no bundler of its own.
import { createRequire } from 'node:module'
import { isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const frontend = process.env.MOBIUS_FRONTEND_NODE_MODULES
const { rolldown } = frontend
  ? await import(pathToFileURL(
      createRequire(join(frontend, 'package.json')).resolve('rolldown'),
    ).href)
  : await import('rolldown')

const bundle = await rolldown({
  input: 'index.jsx',
  platform: 'browser',
  tsconfig: false,
  moduleTypes: { '.js': 'jsx' },
  transform: { jsx: 'react-jsx' },
  external: (id) => !id.startsWith('.') && !isAbsolute(id),
})
await bundle.generate({ format: 'es' })
await bundle.close()
console.log('compile smoke: index.jsx bundles cleanly')
