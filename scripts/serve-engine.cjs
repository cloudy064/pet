const http = require('node:http'),
  fs = require('node:fs'),
  path = require('node:path');
const root = path.resolve(__dirname, '..'),
  port = Number(process.env.PORT || 8765);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
};
http
  .createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405);
      response.end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/') {
        response.writeHead(302, { Location: encodeURI('/皮皮_引擎工作台.html') });
        response.end();
        return;
      }
      let file = path.resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + path.sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
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
        ETag: etag,
      });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404);
      response.end('File not found');
    }
  })
  .listen(port, '127.0.0.1', () => console.log(`Pipi studio: http://127.0.0.1:${port}/`));
