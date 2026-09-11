const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'),
  source = path.join(root, 'assets/engine');
const target = process.argv[2];
if (!target) throw Error('Usage: npm run export:assets -- <output-directory>');
const destination = path.resolve(target),
  manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'))),
  files = new Set();
for (const asset of Object.values(manifest.assets))
  for (const page of asset.pages) {
    const content = fs.readFileSync(path.join(source, page.file)),
      digest = crypto.createHash('md5').update(content).digest('hex');
    if (digest !== page.md5 || content.length !== page.bytes)
      throw Error('Asset missing or checksum mismatch; run git lfs pull: ' + page.file);
    files.add(page.file);
  }
fs.mkdirSync(destination, { recursive: true });
for (const file of [...files, 'manifest.json'])
  fs.copyFileSync(path.join(source, file), path.join(destination, file));
console.log(`Exported ${files.size} verified PNG atlases and manifest to ${destination}`);
