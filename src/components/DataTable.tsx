// 정렬·선택 가능한 데이터 표
import { useMemo, useState, type ReactNode } from "react";
import { LuArrowDown, LuArrowUp, LuArrowUpDown } from "react-icons/lu";

export interface Col<T> {
  key: string;
  label: string;
  render: (r: T) => ReactNode;
  sort?: (r: T) => string | number | null | undefined;
  num?: boolean;
  sticky?: boolean;
}

export function DataTable<T>({
  rows,
  cols,
  rowKey,
  selectedKey,
  onSelect,
  empty,
  label,
  initialSort,
}: {
  rows: T[];
  cols: Col<T>[];
  rowKey: (r: T) => string;
  selectedKey?: string | null;
  onSelect?: (r: T) => void;
  empty?: ReactNode;
  label: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = cols.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "ko");
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, cols, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: cols.find((c) => c.key === key)?.num ? "desc" : "asc" }));

  return (
    <div className="table-scroll data-table-wrap">
      <table className="data-table" aria-label={label}>
        <thead>
          <tr>
            {cols.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th key={c.key} className={`${c.num ? "num" : ""} ${c.sticky ? "sticky-col" : ""}`} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}>
                  {c.sort ? (
                    <button type="button" className="th-sort" onClick={() => toggle(c.key)}>
                      {c.label}
                      {active ? sort!.dir === "asc" ? <LuArrowUp aria-hidden /> : <LuArrowDown aria-hidden /> : <LuArrowUpDown aria-hidden className="th-sort-idle" />}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const k = rowKey(r);
            const sel = k === selectedKey;
            return (
              <tr
                key={k}
                className={sel ? "is-selected" : undefined}
                onClick={() => onSelect?.(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(r);
                  }
                }}
                tabIndex={onSelect ? 0 : undefined}
                aria-selected={onSelect ? sel : undefined}
              >
                {cols.map((c) => (
                  <td key={c.key} className={`${c.num ? "num" : ""} ${c.sticky ? "sticky-col" : ""}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!sorted.length && <div className="table-empty">{empty ?? "표시할 행이 없습니다."}</div>}
    </div>
  );
}
