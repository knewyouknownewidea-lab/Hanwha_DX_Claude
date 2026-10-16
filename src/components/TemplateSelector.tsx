// B: 결과 형식 선택 카드 — AI가 추천하지만 사용자가 고른다
import type { AnalysisResult, TemplateId } from "../lib/analysisTypes";
import { TEMPLATES, templateLabel } from "../templates/registry";

const NUM = ["①", "②", "③", "④"];

export function TemplateSelector({
  result,
  chosen,
  keep,
  onChoose,
  disabled,
}: {
  result: AnalysisResult;
  chosen?: TemplateId | null;
  keep?: TemplateId | null;
  onChoose: (t: TemplateId) => void;
  disabled?: boolean;
}) {
  const order = keep ? [keep, ...result.templates.filter((t) => t !== keep)] : result.templates;
  return (
    <div className="tpl-grid" role="group" aria-label="결과 형식 선택">
      {order.map((id, i) => {
        const def = TEMPLATES[id];
        const Icon = def.icon;
        const isRec = !keep && id === result.recommended;
        const isKeep = keep === id;
        return (
          <button
            type="button"
            key={id}
            className={`tpl-card ${chosen === id ? "is-chosen" : ""} ${isRec || isKeep ? "is-rec" : ""}`}
            onClick={() => onChoose(id)}
            disabled={disabled}
            aria-pressed={chosen === id}
            data-template={id}
          >
            <span className="tpl-top">
              <span className="tpl-num" aria-hidden>
                {NUM[i]}
              </span>
              <Icon aria-hidden className="tpl-icon" />
              {isRec && <span className="tpl-badge">추천</span>}
              {isKeep && <span className="tpl-badge">현재 형식 유지</span>}
            </span>
            <span className="tpl-label">{templateLabel(id, result.kind)}</span>
            <span className="tpl-desc">{result.templateHints[id] ?? def.description}</span>
          </button>
        );
      })}
    </div>
  );
}
