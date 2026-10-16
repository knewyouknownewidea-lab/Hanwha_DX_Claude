// 데이터 불러오기: CSV/JSON 업로드 → 헤더 매핑·형식 검사 → 교체 또는 병합
import { useEffect, useRef, useState } from "react";
import { LuCircleAlert, LuDownload, LuFileUp, LuX } from "react-icons/lu";
import { DATASET_LABEL, type DatasetKey } from "../data/types";
import { SCHEMAS } from "../data/schema";
import { parseCSV, toCSV } from "../lib/csv";
import { guessDataset, rowsFromJSON, validateRows, type ValidationResult } from "../lib/validate";
import { saveFile } from "../platform/runtime";
import { useStore } from "../store/store";

const DATASETS: DatasetKey[] = ["suppliers", "purchaseOrders", "contracts", "inventory", "items"];

export function ImportDialog() {
  const { state, dispatch } = useStore();
  const open = state.importFor !== null;
  const [dataset, setDataset] = useState<DatasetKey>("suppliers");
  const [file, setFile] = useState<{ name: string; raw: Record<string, unknown>[] } | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"replace" | "merge">("merge");
  const [hint, setHint] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setDataset(state.importFor as DatasetKey);
      setFile(null);
      setResult(null);
      setError(null);
      setHint(null);
      setTimeout(() => dialogRef.current?.focus(), 0);
    }
  }, [open, state.importFor]);

  useEffect(() => {
    if (file) setResult(validateRows(dataset, file.raw, state.data));
  }, [dataset, file, state.data]);

  if (!open) return null;
  const close = () => dispatch({ type: "openImport", dataset: null });

  const readFile = async (f: File) => {
    setError(null);
    setHint(null);
    try {
      const text = await f.text();
      const isJSON = /\.json$/i.test(f.name) || text.trim().startsWith("[") || text.trim().startsWith("{");
      const raw = isJSON ? rowsFromJSON(text, dataset) : (parseCSV(text) as Record<string, unknown>[]);
      if (!raw.length) throw new Error("데이터 행이 없습니다");
      const guess = guessDataset(Object.keys(raw[0]));
      if (guess && guess !== dataset) setHint(`열 이름으로 보면 '${DATASET_LABEL[guess]}' 데이터 같습니다.`);
      setFile({ name: f.name, raw });
    } catch (e) {
      setFile(null);
      setResult(null);
      setError(`파일을 읽지 못했습니다: ${(e as Error).message}. CSV(첫 줄은 열 이름) 또는 JSON 배열 형식인지 확인해 주세요.`);
    }
  };

  const apply = () => {
    if (!result || !file || !result.rows.length) return;
    dispatch({ type: "replaceData", dataset, rows: result.rows, source: file.name, mode });
    dispatch({
      type: "toast",
      text: `${DATASET_LABEL[dataset]} ${result.rows.length}행을 ${mode === "replace" ? "교체" : "병합"}했습니다. 평가와 지표를 다시 계산했습니다.`,
    });
    close();
  };

  const downloadTemplate = async () => {
    const schema = SCHEMAS[dataset];
    const csv = toCSV(
      schema.fields.map((f) => ({ key: f.key, label: f.label })),
      [],
    );
    const r = await saveFile(`${dataset}_양식.csv`, csv, "text/csv;charset=utf-8");
    if (r === "unavailable") dispatch({ type: "toast", text: "이 화면에서는 파일 저장을 쓸 수 없습니다. 아래 필드 안내를 참고해 주세요.", tone: "warn" });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title" tabIndex={-1} ref={dialogRef} onKeyDown={(e) => e.key === "Escape" && close()}>
        <div className="modal-head">
          <h2 id="import-title">데이터 불러오기</h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="닫기">
            <LuX aria-hidden />
          </button>
        </div>
        <div className="modal-body">
          <div className="field-row">
            <label htmlFor="import-dataset">데이터 종류</label>
            <select id="import-dataset" value={dataset} onChange={(e) => setDataset(e.target.value as DatasetKey)}>
              {DATASETS.map((d) => (
                <option key={d} value={d}>
                  {DATASET_LABEL[d]}
                </option>
              ))}
            </select>
          </div>

          <label
            className={`dropzone ${drag ? "is-drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) readFile(f);
            }}
          >
            <LuFileUp aria-hidden />
            <span>{file ? file.name : "CSV 또는 JSON 파일을 끌어다 놓거나 눌러서 선택"}</span>
            <input id="import-file" type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
          </label>
          {hint && <p className="note-warn">{hint} 데이터 종류를 확인해 주세요.</p>}
          {error && (
            <p className="note-bad" role="alert">
              <LuCircleAlert aria-hidden /> {error}
            </p>
          )}

          {result && (
            <div className="validation">
              <div className="validation-stats">
                <span>
                  전체 <b>{result.total}</b>행
                </span>
                <span className="ok">
                  반영 가능 <b>{result.rows.length}</b>행
                </span>
                <span className={result.errors.length ? "bad" : ""}>
                  오류 <b>{result.errors.length}</b>건
                </span>
                <span className={result.warnings.length ? "warn" : ""}>
                  경고 <b>{result.warnings.length}</b>건
                </span>
              </div>
              <p className="small">
                연결된 열: {result.mapped.map((m) => `${m.source}→${m.label}`).join(", ") || "없음"}
                {result.unmapped.length ? ` · 사용하지 않는 열: ${result.unmapped.join(", ")}` : ""}
              </p>
              {[...result.errors.slice(0, 6).map((i) => ({ ...i, t: "bad" })), ...result.warnings.slice(0, 4).map((i) => ({ ...i, t: "warn" }))].map((i, k) => (
                <p key={k} className={`issue issue-${i.t}`}>
                  {i.row ? `${i.row}행` : "파일"}
                  {i.field ? ` · ${i.field}` : ""}: {i.message}
                </p>
              ))}
              {result.errors.length > 6 && <p className="small muted">오류 {result.errors.length - 6}건 더 있음 · 오류가 있는 행은 반영하지 않습니다.</p>}
              <fieldset className="mode">
                <legend>반영 방식</legend>
                <label>
                  <input type="radio" name="import-mode" id="mode-merge" checked={mode === "merge"} onChange={() => setMode("merge")} /> 병합 (같은 키는 덮어쓰기)
                </label>
                <label>
                  <input type="radio" name="import-mode" id="mode-replace" checked={mode === "replace"} onChange={() => setMode("replace")} /> 교체 (기존 {DATASET_LABEL[dataset]} 전체 바꾸기)
                </label>
              </fieldset>
            </div>
          )}

          <details className="schema-help">
            <summary>필드 안내 · {DATASET_LABEL[dataset]}</summary>
            <table>
              <thead>
                <tr>
                  <th>열 이름</th>
                  <th>필드</th>
                  <th>형식</th>
                  <th>필수</th>
                </tr>
              </thead>
              <tbody>
                {SCHEMAS[dataset].fields.map((f) => (
                  <tr key={f.key}>
                    <td>{f.label}</td>
                    <td className="code">{f.key}</td>
                    <td>
                      {{ string: "문자", number: "숫자", date: "날짜(YYYY-MM-DD)", grade: "A~D", list: "목록(;)", boolean: "예/아니오", history: "연도:등급:점수;…" }[f.type]}
                      {f.hint ? ` · ${f.hint}` : ""}
                    </td>
                    <td>{f.required ? "필수" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted">기본 키: {SCHEMAS[dataset].primaryKey} · 협력사는 업체ID, 품목은 품목코드로 다른 표와 연결됩니다.</p>
          </details>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-quiet" onClick={downloadTemplate}>
            <LuDownload aria-hidden /> 빈 양식 받기
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-quiet" onClick={close}>
            취소
          </button>
          <button type="button" className="btn btn-primary" onClick={apply} disabled={!result || !result.rows.length}>
            {result ? `${result.rows.length}행 반영` : "반영"}
          </button>
        </div>
      </div>
    </div>
  );
}
