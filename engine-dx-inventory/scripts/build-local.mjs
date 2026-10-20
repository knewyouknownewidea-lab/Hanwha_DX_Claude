import {cp, mkdir, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {writeDependencyNotices} from './license-notices.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputName = process.env.INTEGRATED_BUILD_DIR || 'local-dist';
if (!['dist', 'local-dist'].includes(outputName)) throw new Error('INTEGRATED_BUILD_DIR은 dist 또는 local-dist여야 합니다.');
const output = path.join(root, outputName);
const extraModules = process.env.INTEGRATED_NODE_MODULES;
const nodePaths = [path.join(root, 'node_modules'), path.join(root,'.preview-runtime','node_modules'), ...(extraModules ? [path.resolve(extraModules)] : [])];
const require = createRequire(import.meta.url);

let esbuild;
let buildEngine;
// WASM uses Node's filesystem on restricted Windows hosts while retaining
// esbuild's standard browser/package/exports resolution and tree shaking.
for (const candidate of ['esbuild-wasm', 'esbuild']) {
  try {
    const entry = require.resolve(candidate, {paths: nodePaths.map(p => path.dirname(p))});
    esbuild = await import(pathToFileURL(entry).href);
    buildEngine = candidate;
    break;
  } catch { /* Try the other supported engine. */ }
}
if (!esbuild) throw new Error('esbuild-wasm 또는 esbuild가 필요합니다. 로컬 의존성을 설치하거나 INTEGRATED_NODE_MODULES에 node_modules 경로를 지정하세요.');

await mkdir(path.join(output, 'assets'), {recursive: true});
await cp(path.join(root, 'public'), output, {recursive: true});
await cp(path.join(root, 'local/index.html'), path.join(output, 'index.html'));

const result = await esbuild.build({
  absWorkingDir: root,
  entryPoints: {workspace: path.join(root, 'local/main.tsx')},
  outdir: path.join(output, 'assets'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  tsconfigRaw: {compilerOptions: {jsx: 'react-jsx', target: 'ES2022', module: 'ESNext', baseUrl: root, paths: {'@/*': ['./*']}}},
  sourcemap: true,
  minify: false,
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  assetNames: '[name]-[hash]',
  nodePaths,
  alias: {
    'next/dynamic': path.join(root, 'local/next-dynamic.tsx'),
    '@': root,
  },
  write: false,
  define: {'process.env.NODE_ENV': '"production"'},
  metafile: true,
  logLevel: 'info',
});

for (const file of result.outputFiles) {
  await mkdir(path.dirname(file.path), {recursive: true});
  await writeFile(file.path, file.contents);
}
await writeDependencyNotices(root,output,Object.keys(result.metafile.inputs));

await writeFile(path.join(output, 'build-info.json'), JSON.stringify({
  kind: 'browser-only-local-preview',
  buildEngine,
  workspaceSource: 'app/Workspace.tsx',
  dynamicImportShim: 'local/next-dynamic.tsx',
  note: '동일 Workspace의 로컬 정적 빌드입니다. Vinext 서버/API 검증을 의미하지 않습니다.',
  inputs: Object.keys(result.metafile.inputs),
}, null, 2));
console.log(`통합 로컬 미리보기 빌드: ${output}`);
