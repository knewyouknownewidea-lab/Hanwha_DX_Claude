import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const outputName = process.env.INTEGRATED_BUILD_DIR || 'local-dist';
if (!['dist', 'local-dist'].includes(outputName)) throw new Error('INTEGRATED_BUILD_DIR은 dist 또는 local-dist여야 합니다.');
const root = fileURLToPath(new URL(`../${outputName}/`, import.meta.url));
const port = Number(process.env.PORT || process.argv[2] || 5179);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('올바른 PORT를 지정하세요.');
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.map': 'application/json',
};
const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, {'Allow': 'GET, HEAD'}).end();
      return;
    }
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const requested = decodeURIComponent(url.pathname);
    const relative = requested.replace(/^[/\\]+/, '') || 'index.html';
    let file = path.resolve(root, relative);
    const inside = path.relative(root, file);
    if (inside.startsWith('..') || path.isAbsolute(inside)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    let info;
    try { info = await stat(file); } catch {
      // Static JSON/model failures remain genuine 404s, not the app HTML.
      if (path.extname(requested)) { response.writeHead(404).end('Not found'); return; }
      file = path.join(root, 'index.html');
      info = await stat(file);
    }
    if (info.isDirectory()) { file = path.join(file, 'index.html'); info = await stat(file); }
    response.writeHead(200, {
      'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    if (!response.headersSent) response.writeHead(404).end('Not found');
    else response.destroy();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`통합 부품 재고 미리보기: http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
