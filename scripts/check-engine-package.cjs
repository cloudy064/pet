'use strict';
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  vm = require('node:vm'),
  { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run through npm run test:package');
const run = (args, cwd = root) =>
  execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
const packed = require('./package-engine.cjs')({ build: false, npmCli }),
  tarball = path.join(root, packed.filename);
for (const needed of [
  'dist/index.cjs',
  'dist/index.mjs',
  'dist/index.d.ts',
  'dist/pipi-engine.js',
  'dist/miniprogram/index.js',
  'dist/miniprogram/component/index.wxml',
  'dist/companion/index.cjs',
  'dist/companion/index.mjs',
  'dist/companion/index.d.ts',
  'dist/miniprogram/companion.js',
  'dist/pipi-companion.js',
  'docs/ENGINE_API.md',
  'docs/ENGINE_INTEGRATION.md',
  'docs/PET_COMPANION_API.md',
])
  if (!packed.files.some((f) => f.path === needed)) throw Error('Missing package file: ' + needed);
if (packed.files.some((f) => /^dist\/(optimized-|\.pipi-opt-)/.test(f.path)))
  throw Error('Generated optimization packs must be exported separately, not bundled in the SDK');
if (packed.files.some((f) => f.path.startsWith('node_modules/') || /\.env|C:\\Users|edge-/.test(f.path)))
  throw Error('Unexpected machine files in package');
const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'pipi-engine-consumer-'));
fs.writeFileSync(
  path.join(consumer, 'package.json'),
  JSON.stringify({ name: 'pipi-consumer-check', version: '1.0.0', private: true })
);
run(['install', '--no-audit', '--no-fund', tarball], consumer);
const cjs = `const assert=require('node:assert/strict'); const api=require('@cloudy064/pipi-engine'); const wx=require('@cloudy064/pipi-engine/wechat'); assert.equal(typeof api.createWebPet,'function'); assert.equal(typeof wx.createWechatPet,'function'); assert.equal(typeof wx.createWechatComponent,'function'); const actions=new api.ActionRegistry([{id:'custom',type:'clip',asset:'demo'}]); assert.equal(actions.get('custom').id,'custom'); console.log('CJS and WeChat consumer imports: PASS');`;
fs.writeFileSync(path.join(consumer, 'check.cjs'), cjs);
execFileSync(process.execPath, ['check.cjs'], { cwd: consumer, stdio: 'inherit' });
const playbackCheck = `
const {PipiEngine}=require('@cloudy064/pipi-engine');
const {PetCompanion,createMemoryStore,growthHeight}=require('@cloudy064/pipi-engine/companion');
const assert=require('node:assert/strict');
(async()=>{
  const ctx={setTransform(){},clearRect(){},drawImage(){}};
  const adapter={canvas:{width:700,height:600,getContext:()=>ctx},resize(){},loadImage:async p=>({width:p.width,height:p.height}),releaseImage(){},now:()=>0,requestFrame:()=>0,cancelFrame(){}};
  const pet=new PipiEngine({adapter,autoTick:false,autoBlink:false});await pet.ready;
  const wave=pet.play('wave');await wave.ready;pet.stepFrame(1);assert.equal(pet.snapshot().frame,1);
  pet.resume();pet.update(wave.duration+1);assert.equal((await wave).status,'finished');
  const companion=new PetCompanion(pet,{storage:createMemoryStore(),mode:'learning'});await companion.ready;
  await companion.handleEvent({id:'installed-task',type:'taskCompleted',revision:1});assert.equal(companion.state.growthPoints,1);
  companion.setMode('home');assert.equal(pet.size,growthHeight(1));companion.destroy();
  pet.destroy();await new Promise(resolve=>setImmediate(resolve));assert.equal(pet.assets.stats().bytes,0);console.log('Installed package playback and disposal: PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});`;
fs.writeFileSync(path.join(consumer, 'play.cjs'), playbackCheck);
execFileSync(process.execPath, ['play.cjs'], { cwd: consumer, stdio: 'inherit' });
fs.writeFileSync(
  path.join(consumer, 'check.mjs'),
  `import {createWebPet,AnimationPlan,DEFAULT_ACTIONS} from '@cloudy064/pipi-engine'; import {PetCompanion,growthHeight} from '@cloudy064/pipi-engine/companion'; if(typeof createWebPet!=='function'||!DEFAULT_ACTIONS.length||!(new AnimationPlan())||typeof PetCompanion!=='function'||growthHeight(0)!==58)throw Error('ESM exports'); console.log('ESM consumer import: PASS');`
);
execFileSync(process.execPath, ['check.mjs'], { cwd: consumer, stdio: 'inherit' });
const entry = fs.readFileSync(
    path.join(consumer, 'node_modules/@cloudy064/pipi-engine/dist/miniprogram/index.js'),
    'utf8'
  ),
  sandbox = { module: { exports: {} }, exports: {}, setTimeout, clearTimeout };
vm.runInNewContext(entry, sandbox, { timeout: 5000 });
if (typeof sandbox.module.exports.createWechatPet !== 'function')
  throw Error('WeChat entry depends on missing globals');
const companionSandbox = { module: { exports: {} }, exports: {} };
vm.runInNewContext(
  fs.readFileSync(
    path.join(consumer, 'node_modules/@cloudy064/pipi-engine/dist/miniprogram/companion.js'),
    'utf8'
  ),
  companionSandbox,
  { timeout: 5000 }
);
if (typeof companionSandbox.module.exports.PetCompanion !== 'function')
  throw Error('WeChat companion entry depends on missing globals');
fs.writeFileSync(
  path.join(consumer, 'companion-types.ts'),
  `
import {createWebPet} from '@cloudy064/pipi-engine';
import {PetCompanion,createWebStore} from '@cloudy064/pipi-engine/companion';
const pet=createWebPet(document.createElement('canvas'));
const companion=new PetCompanion(pet,{storage:createWebStore(localStorage)});
companion.handleEvent({id:'task',type:'taskCompleted',revision:1});
companion.setMode('learning');
`
);
execFileSync(
  process.execPath,
  [
    require.resolve('typescript/bin/tsc'),
    '--strict',
    '--noEmit',
    '--target',
    'es2020',
    '--module',
    'Node16',
    '--moduleResolution',
    'Node16',
    'companion-types.ts',
  ],
  { cwd: consumer, stdio: 'inherit' }
);
const bundle = require('esbuild').buildSync({
  stdin: {
    contents:
      "import {createWebPet} from '@cloudy064/pipi-engine'; globalThis.consumerPetFactory=createWebPet;",
    resolveDir: consumer,
  },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  write: false,
});
const bundledContext = {};
vm.runInNewContext(bundle.outputFiles[0].text, bundledContext, { timeout: 5000 });
if (typeof bundledContext.consumerPetFactory !== 'function')
  throw Error('Browser bundler consumer import failed');
console.log('Browser bundler consumer import: PASS');
const report = {
  result: 'PASS',
  tarball: packed.filename,
  compressedBytes: packed.size,
  unpackedBytes: packed.unpackedSize,
  files: packed.files.map((f) => f.path),
  consumer,
  formats: ['CommonJS', 'ES module', 'WeChat without DOM or Node globals'],
};
fs.mkdirSync(path.join(root, 'test-results/engine'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results/engine/package.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
