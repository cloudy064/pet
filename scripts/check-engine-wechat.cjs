const fs = require('node:fs'),
  path = require('node:path'),
  { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'),
  example = path.join(root, 'examples/wechat'),
  output = path.join(root, 'test-results/engine');
require('./prepare-wechat-example.cjs');
fs.mkdirSync(output, { recursive: true });
const install =
  process.env.WECHAT_DEVTOOLS ||
  path.join(process.env['ProgramFiles(x86)'] || '', 'Tencent', '微信web开发者工具');
const binary = path.join(install, 'code/package.nw/node_modules/wcc-exec');
const wcc = process.env.WCC_BIN || path.join(binary, 'wcc.exe'),
  wcsc = process.env.WCSC_BIN || path.join(binary, 'wcsc.exe');
for (const file of [wcc, wcsc])
  if (!fs.existsSync(file))
    throw new Error('Set WECHAT_DEVTOOLS or WCC_BIN/WCSC_BIN to installed WeChat native compilers');
const entries = ['pages/index/index', 'lib/pipi/component/index'];
execFileSync(wcc, ['-o', path.join(output, 'wechat-wxml.js'), ...entries.map((p) => './' + p + '.wxml')], {
  cwd: example,
  stdio: 'pipe',
});
const css = execFileSync(wcsc, ['-js', '-pc', '2', ...entries.map((p) => './' + p + '.wxss'), './app.wxss'], {
  cwd: example,
  encoding: 'utf8',
});
if (!css.includes('setCssToHead') || !css.includes('pages/index/index.wxss'))
  throw Error('Native stylesheet compiler did not return the sample styles');
fs.writeFileSync(path.join(output, 'wechat-wxss.js'), css);
for (const file of ['wechat-wxml.js', 'wechat-wxss.js'])
  if (fs.statSync(path.join(output, file)).size < 100) throw Error('Empty native compile output');
const report = {
  result: 'PASS',
  templates: entries,
  entry: 'lib/pipi/index.js',
  runtime: 'Native template compilation + adapter contract tests; device visual verification is separate.',
};
fs.writeFileSync(path.join(output, 'wechat-compile.json'), JSON.stringify(report, null, 2));
console.log('WeChat native WXML and WXSS compilation: PASS');
