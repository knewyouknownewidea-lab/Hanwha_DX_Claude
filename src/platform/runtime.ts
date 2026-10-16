// 실행 환경별 차이를 한곳에서 처리한다
// - 로컬 실행(npm run dev/start): 브라우저 다운로드와 인쇄를 그대로 사용
// - claude.ai 아티팩트: 파일 저장은 downloads 기능으로, 인쇄 대신 보고서 HTML 저장
import { isArtifactViewer } from "../ai/llm";

type DownloadsNS = { save: (req: { filename: string; data: string | Blob }) => Promise<{ status: string }> };

export const inArtifact = () => isArtifactViewer();
export const canPrint = () => !inArtifact();

export async function saveFile(filename: string, content: string, mime: string): Promise<"saved" | "declined" | "unavailable"> {
  if (inArtifact()) {
    try {
      const c = (window as unknown as { claude: { use: (n: string) => Promise<unknown> } }).claude;
      const dl = (await c.use("downloads")) as DownloadsNS | null;
      if (!dl) return "unavailable";
      await dl.save({ filename, data: content });
      return "saved";
    } catch (e) {
      const code = (e as { code?: string })?.code;
      return code === "declined" ? "declined" : "unavailable";
    }
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "saved";
}

export function printReport() {
  document.body.classList.add("printing-report");
  const done = () => {
    document.body.classList.remove("printing-report");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
  setTimeout(done, 1500);
}

/** 보고서 영역을 독립 HTML 문서로 만든다 (아티팩트에서 인쇄 대신 저장) */
export function reportDocument(title: string, bodyHTML: string): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>
<style>
body{font-family:"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1d1e20;max-width:820px;margin:32px auto;padding:0 24px;line-height:1.6;font-size:14px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f4f1}
.num{text-align:right;font-variant-numeric:tabular-nums}.muted{color:#6b6d72}ul{padding-left:20px}
.report-actions,button{display:none!important}
@media print{body{margin:0}}
</style></head><body>${bodyHTML}</body></html>`;
}
