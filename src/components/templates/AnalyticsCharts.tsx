// 템플릿 ②: 데이터 시각화
import type { AnalysisResult } from "../../lib/analysisTypes";
import { Chart } from "../charts/Chart";
import { Highlights } from "./shared";

export function AnalyticsCharts({ result }: { result: AnalysisResult }) {
  return (
    <div className="tpl tpl-charts">
      <Highlights result={result} />
      {result.summary[1] && <p className="lede">{result.summary[1]}</p>}
      <div className="chart-grid">
        {result.charts.map((c) => (
          <Chart key={c.id} spec={c} />
        ))}
      </div>
      <p className="small muted">
        기준일 {result.asOf} · {result.dataLabel} · 막대는 0에서 시작합니다. 그래프에 마우스를 올리면 값이 표시되고, 각 그래프 아래 ‘데이터 표’에서 숫자를 확인할 수 있습니다.
      </p>
    </div>
  );
}
