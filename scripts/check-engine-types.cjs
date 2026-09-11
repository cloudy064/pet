const { execFileSync } = require('node:child_process'),
  path = require('node:path');
const root = path.resolve(__dirname, '..'),
  tsc = require.resolve('typescript/bin/tsc');
for (const [file, lib] of [
  ['web.ts', 'es2020,dom'],
  ['wechat.ts', 'es2020'],
])
  execFileSync(
    process.execPath,
    [
      tsc,
      '--strict',
      '--noEmit',
      '--skipLibCheck',
      'false',
      '--target',
      'es2020',
      '--module',
      'commonjs',
      '--lib',
      lib,
      'tests/types/' + file,
    ],
    { cwd: root, stdio: 'inherit' }
  );
console.log('Public types: Web + official WeChat API types, without DOM in WeChat: PASS');
