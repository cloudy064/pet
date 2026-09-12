'use strict';
const fs = require('node:fs'),
  path = require('node:path'),
  os = require('node:os'),
  { execFileSync } = require('node:child_process');
function packageEngine({ build = true, npmCli = process.env.npm_execpath } = {}) {
  if (!npmCli) throw Error('Run npm run pack:engine');
  const root = path.resolve(__dirname, '..');
  if (build)
    execFileSync(process.execPath, [path.join(__dirname, 'build-engine.cjs')], {
      cwd: root,
      stdio: 'inherit',
    });
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'pipi-engine-package-'));
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
    // Consumers receive built files only and never need to execute build/install hooks.
    delete pkg.scripts;
    delete pkg.devDependencies;
    for (const relative of pkg.files)
      fs.cpSync(path.join(root, relative), path.join(stage, relative), { recursive: true });
    fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(pkg, null, 2));
    const output = execFileSync(
      process.execPath,
      [npmCli, 'pack', stage, '--pack-destination', root, '--json', '--ignore-scripts'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
    );
    const data = JSON.parse(output);
    return Array.isArray(data) ? data[0] : data[pkg.name];
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}
module.exports = packageEngine;
if (require.main === module) {
  const result = packageEngine();
  console.log(
    JSON.stringify({ file: result.filename, bytes: result.size, unpackedBytes: result.unpackedSize }, null, 2)
  );
}
