const fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '..');
const from = path.join(root, 'dist/miniprogram'),
  to = path.join(root, 'examples/wechat/lib/pipi');
if (!fs.existsSync(path.join(from, 'index.js'))) throw new Error('Run npm run build first');
fs.cpSync(from, to, { recursive: true });
console.log('Ready: import examples/wechat into WeChat DevTools.');
