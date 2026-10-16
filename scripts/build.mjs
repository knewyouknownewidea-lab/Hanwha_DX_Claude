// 빌드: esbuild로 번들한 JS·CSS를 HTML 한 파일에 넣는다.
//   node scripts/build.mjs          → dist/index.html (로컬 실행용 완전한 문서)
//                                      dist/artifact.html (claude.ai 아티팩트 게시용 본문)
//   node scripts/build.mjs --watch  → 소스가 바뀔 때마다 다시 빌드
import * as esbuild from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");
mkdirSync(dist, { recursive: true });

const TITLE = "구매·협력사 AI 분석";
const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">';

function writeHtml(result) {
  const js = result.outputFiles.find((f) => f.path.endsWith(".js"))?.text ?? "";
  const css = result.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
  const safeJs = js.replace(/<\/script/gi, "<\\/script");
  const body =
    `<title>${TITLE}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${FONTS}\n` +
    `<style>${css}</style>\n<div id="root"></div>\n<script>${safeJs}</script>\n`;
  writeFileSync(join(dist, "artifact.html"), body);
  // index.html: 로컬 서버용 완전한 문서 (스크립트는 본문 끝)
  writeFileSync(
    join(dist, "index.html"),
    `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<title>${TITLE}</title>\n${FONTS}\n<style>${css}</style></head>\n<body><div id="root"></div><script>${safeJs}</script></body></html>\n`,
  );
  const kb = (Buffer.byteLength(body) / 1024).toFixed(0);
  console.log(`[build] dist/index.html, dist/artifact.html (${kb} KB)`);
}

const options = {
  entryPoints: [join(root, "src", "main.tsx")],
  bundle: true,
  minify: !watch,
  sourcemap: false,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  outdir: dist,
  write: false,
  loader: { ".json": "json" },
  define: { "process.env.NODE_ENV": watch ? '"development"' : '"production"' },
  legalComments: "none",
  logLevel: "warning",
  plugins: [
    {
      name: "single-html",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length) return;
          writeHtml(result);
        });
      },
    },
  ],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("[build] 변경을 감시합니다");
} else {
  await esbuild.build(options);
}
