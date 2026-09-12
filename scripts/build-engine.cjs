'use strict';
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
async function build() {
  const common = {
    entryPoints: [path.join(root, 'engine/index.js')],
    bundle: true,
    target: ['es2018'],
    legalComments: 'none',
    logLevel: 'warning',
  };
  for (const [file, format, extras] of [
    ['index.cjs', 'cjs', {}],
    ['index.mjs', 'esm', {}],
    ['pipi-engine.js', 'iife', { globalName: 'Pipi', minify: true }],
    ['miniprogram/index.js', 'cjs', {}],
  ]) {
    const entry =
      format === 'esm'
        ? {
            entryPoints: undefined,
            stdin: {
              contents:
                "import api from './engine/index.js'; export const {" +
                Object.keys(require('../engine')).join(',') +
                '}=api; export default api;',
              resolveDir: root,
              sourcefile: 'exports.mjs',
            },
          }
        : {};
    await esbuild.build({ ...common, ...entry, format, outfile: path.join(root, 'dist', file), ...extras });
  }
  if (fs.existsSync(path.join(root, 'engine/index.d.ts')))
    fs.copyFileSync(path.join(root, 'engine/index.d.ts'), path.join(root, 'dist/index.d.ts'));
  fs.cpSync(path.join(root, 'engine/miniprogram-component'), path.join(root, 'dist/miniprogram/component'), {
    recursive: true,
  });
  if (fs.existsSync(path.join(root, 'engine/index.d.ts')))
    fs.copyFileSync(path.join(root, 'engine/index.d.ts'), path.join(root, 'dist/miniprogram/index.d.ts'));
  for (const [file, format, extras] of [
    ['companion/index.cjs', 'cjs', {}],
    ['companion/index.mjs', 'esm', {}],
    ['pipi-companion.js', 'iife', { globalName: 'PipiCompanion', minify: true }],
    ['miniprogram/companion.js', 'cjs', {}],
  ]) {
    const entry =
      format === 'esm'
        ? {
            stdin: {
              contents:
                "import api from './engine/companion/index.js'; export const {" +
                Object.keys(require('../engine/companion')).join(',') +
                '}=api; export default api;',
              resolveDir: root,
              sourcefile: 'companion-exports.mjs',
            },
          }
        : { entryPoints: [path.join(root, 'engine/companion/index.js')] };
    await esbuild.build({
      ...entry,
      bundle: true,
      target: ['es2018'],
      legalComments: 'none',
      format,
      outfile: path.join(root, 'dist', file),
      ...extras,
    });
  }
  const declarations = fs.readFileSync(path.join(root, 'engine/companion/index.d.ts'), 'utf8');
  fs.writeFileSync(path.join(root, 'dist/companion/index.d.ts'), declarations);
  fs.writeFileSync(
    path.join(root, 'dist/miniprogram/companion.d.ts'),
    declarations.replace("'../index'", "'./index'")
  );
  console.log('Built CommonJS, ES module, browser global and WeChat entries.');
}
build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
