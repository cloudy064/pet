const http = require('node:http'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '..'),
  port = Number(process.env.PORT || 8765),
  demo = process.argv.includes('--demo'),
  host = process.env.HOST || (demo ? '0.0.0.0' : '127.0.0.1');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.md': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
};
http
  .createServer((request, response) => {
    if (demo && request.method === 'POST' && request.url === '/__debug/events') {
      let body = '',
        oversized = false;
      request.on('data', (chunk) => {
        if (oversized) return;
        body += chunk;
        if (Buffer.byteLength(body) > 65536) {
          oversized = true;
          body = '';
        }
      });
      request.on('end', () => {
        try {
          if (oversized) throw Error('Log batch too large');
          const rows = JSON.parse(body);
          if (!Array.isArray(rows) || rows.length > 30) throw Error('Invalid log batch');
          const folder = path.join(root, 'test-results');
          fs.mkdirSync(folder, { recursive: true });
          const file = path.join(folder, 'demo-debug.ndjson');
          if (fs.existsSync(file) && fs.statSync(file).size > 2 * 1024 * 1024)
            fs.renameSync(file, file + '.previous');
          fs.appendFileSync(
            file,
            rows.map((row) => JSON.stringify({ received: new Date().toISOString(), ...row })).join('\n') +
              '\n'
          );
          response.writeHead(204);
          response.end();
        } catch {
          response.writeHead(400);
          response.end('Invalid logs');
        }
      });
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    try {
      const url = new URL(request.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname === '/') {
        response.writeHead(302, {
          Location: demo ? '/examples/sdk-demo/' : encodeURI('/皮皮_引擎工作台.html'),
        });
        response.end();
        return;
      }
      let file = path.resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + path.sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      if (fs.statSync(file).isDirectory()) {
        if (!url.pathname.endsWith('/')) {
          response.writeHead(308, {
            Location: '/' + url.pathname.replace(/^\/+/, '') + '/' + url.search,
            'Cache-Control': 'no-cache',
          });
          response.end();
          return;
        }
        file = path.join(file, 'index.html');
      }
      const stat = fs.statSync(file),
        etag = '"' + stat.size + '-' + stat.mtimeMs + '"';
      if (request.headers['if-none-match'] === etag) {
        response.writeHead(304, { ETag: etag });
        response.end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': /^atlas-[a-f0-9]+\.(png|webp)$/.test(path.basename(file))
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
        ETag: etag,
      });
      if (request.method === 'HEAD') response.end();
      else {
        const stream = fs.createReadStream(file);
        response.on('close', () => stream.destroy());
        stream.on('error', () => response.destroy());
        stream.pipe(response);
      }
    } catch {
      response.writeHead(404);
      response.end('File not found');
    }
  })
  .listen(port, host, () => console.log(`Pipi ${demo ? 'SDK demo' : 'studio'}: http://${host}:${port}/`));
