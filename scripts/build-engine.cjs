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
  console.log('Built CommonJS, ES module, browser global and WeChat entries.');
}
build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
