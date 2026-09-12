const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'),
  companion = process.argv.includes('--companion'),
  optimized = process.argv.includes('--optimized'),
  source = path.join(
    root,
    optimized ? 'dist/optimized-assets' : companion ? 'assets/companion' : 'assets/engine'
  );
const flags = new Set(['--companion', '--optimized']);
const target = process.argv.slice(2).find((arg) => !flags.has(arg));
if (!target) throw Error('Usage: npm run export:assets -- <output-directory>');
const destination = path.resolve(target),
  manifest = JSON.parse(
    fs.readFileSync(path.join(source, optimized && companion ? 'companion.json' : 'manifest.json'))
  ),
  files = new Set();
for (const asset of Object.values(manifest.assets))
  for (const page of asset.pages) {
    const content = fs.readFileSync(path.join(source, page.file)),
      digest = crypto.createHash('md5').update(content).digest('hex');
    if (digest !== page.md5 || content.length !== page.bytes)
      throw Error('Asset missing or checksum mismatch; run git lfs pull: ' + page.file);
    files.add(page.file);
  }
if (companion || optimized) {
  const catalog = JSON.parse(fs.readFileSync(path.join(source, 'audio/catalog.json')));
  files.add('audio/catalog.json');
  for (const track of catalog.tracks) {
    const data = fs.readFileSync(path.join(source, track.audioURL));
    if (crypto.createHash('sha256').update(data).digest('hex') !== track.sha256)
      throw Error('Audio checksum mismatch: ' + track.audioURL);
    files.add(track.audioURL);
  }
}
if (
  destination === source ||
  (optimized && (destination.startsWith(source + path.sep) || source.startsWith(destination + path.sep)))
)
  throw Error('Choose an export directory separate from the source');
const write = (output) => {
  fs.mkdirSync(output, { recursive: true });
  for (const file of files) {
    const input = path.resolve(source, file),
      target = path.resolve(output, file);
    if (!input.startsWith(source + path.sep) || !target.startsWith(output + path.sep))
      throw Error('Invalid asset path: ' + file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(input, target);
  }
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest) + '\n');
};
if (optimized) {
  if (fs.existsSync(destination) && fs.readdirSync(destination).length) {
    let marker;
    try {
      marker = JSON.parse(fs.readFileSync(path.join(destination, '.pipi-export.json')));
    } catch (_) {}
    if (marker?.generator !== 'pipi-optimized-export-v1')
      throw Error('Optimized export needs an empty directory or its own previous export');
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const stage = fs.mkdtempSync(path.join(path.dirname(destination), '.pipi-export-'));
  const next = path.join(stage, 'new'),
    backup = path.join(stage, 'previous');
  try {
    write(next);
    fs.writeFileSync(
      path.join(next, '.pipi-export.json'),
      JSON.stringify({ generator: 'pipi-optimized-export-v1' })
    );
    if (fs.existsSync(destination)) fs.renameSync(destination, backup);
    try {
      fs.renameSync(next, destination);
    } catch (error) {
      if (fs.existsSync(backup)) fs.renameSync(backup, destination);
      throw error;
    }
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
} else write(destination);
console.log(`Exported ${files.size} verified asset files and manifest to ${destination}`);
