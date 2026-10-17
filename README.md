# 구매·협력사 AI 분석 플랫폼 (시연판)

## 별도 프로젝트: 3D 엔진·구매 기술협의

기존 v0.1.0 구매 분석 앱은 저장소 루트에 유지됩니다. 새 6기통 CAD·3D 뷰어·기술협의 시스템은 **[engine-dx/](./engine-dx/README.md)** 에 독립적으로 추가했습니다. 두 앱의 실행 환경과 데이터 저장소는 분리되어 있으며 아직 상호 연동되지 않았습니다.

- [새 시스템 시연 주소](https://hanwha-engine-dx-6g50-demo.knewyouknownewidea.chatgpt.site/) — 소유자 로그인 필요
- [STEP CAD](./engine-dx/cad/STEP/) · [GLB](./engine-dx/cad/GLB/) · [부품 목록](./engine-dx/cad/parts.json)
- [단계별 검증 결과](./engine-dx/verification/단계별-결과.txt)

---

협력사·구매조달·원가-계약·자재-공급 데이터를 한 화면에서 관리하고, 자연어로 분석을 요청하면 AI가 결과 형식을 추천하고, 사용자가 고른 형식으로 결과를 보여 주는 웹 플랫폼입니다.

**데이터 관리(A) → AI 챗봇 분석 요청(B) → 결과 형식 추천(B) → 사용자 선택 → 결과 시각화(C)**

> 모든 업체명·품목·수치는 시연용 가상 데이터(SAMPLE)이며 실제 회사 데이터가 아닙니다.

## 실행 방법

설치 없이 보기: `dist/index.html`을 브라우저로 열면 바로 동작합니다(규칙 기반 데모 모드).

개발 환경 (Node.js 18 이상):

```bash
npm install
npm run dev        # 소스 변경 감시 빌드 + http://localhost:5173
npm start          # 한 번 빌드 후 서버 실행
npm run build      # dist/index.html, dist/artifact.html 생성
```

## 샘플 데이터 위치

| 파일 | 내용 |
|---|---|
| `src/data/sample/suppliers.json` | 협력업체 12곳 (등급, 품질점수, 불량률, 심사 입력값, 평가 이력) |
| `src/data/sample/items.json` | 품목 마스터 10개 |
| `src/data/sample/purchaseOrders.json` | 발주 346건 (발주일, 납기 예정일, 실제 입고일) |
| `src/data/sample/contracts.json` | 계약 23건 (최근·과거 단가, 통화, 인도·결제 조건) |
| `src/data/sample/inventory.json` | 재고 10품목 (현재 재고, 안전재고) |
| `src/data/sample/meta.json` | 기준일(2026-10-15)과 SAMPLE 표기 |

`npm run sample`로 다시 생성합니다(`scripts/generate-sample.mjs`, 시드 고정).

## 데이터 추가 방법

1. 상단 **데이터 불러오기** 또는 각 탭의 **업로드**를 누릅니다.
2. 데이터 종류를 고르고 CSV(첫 줄 열 이름) 또는 JSON 배열 파일을 올립니다.
3. 열 이름은 필드명·한글 이름·별칭으로 자동 연결됩니다(예: `업체ID`, `협력사id`, `supplierId`). 대화상자의 **필드 안내**와 **빈 양식 받기**를 참고하세요.
4. 형식 검사 결과(숫자·날짜·등급·필수값·중복 키·참조 품목/업체)를 확인하고 **병합** 또는 **교체**로 반영합니다. 오류 행은 반영하지 않습니다.
5. 반영하면 평가 점수와 지표를 즉시 다시 계산하고, C에 떠 있는 결과에는 "다시 분석" 안내가 표시됩니다.

연결 키: 협력사 `supplierId`, 품목 `itemCode`, 발주 `poNo`, 계약 `contractId`.

## AI API 연결 방법

LLM은 **질문 해석에만** 쓰고, 수치 계산·업체 비교·근거 문장은 코드가 데이터로 만듭니다. LLM 응답은 목록에 있는 품목코드·업체ID만 남기도록 검증합니다.

```bash
ANTHROPIC_API_KEY=발급받은_키 LLM_MODEL=claude-haiku-5-5 npm start
```

- 키는 서버 환경변수로만 읽고 브라우저 코드에 넣지 않습니다(`server/index.mjs`의 `/api/ai/interpret`).
- 연결되면 상단 상태가 "LLM 사용 가능"으로 바뀌고 **LLM 해석** 모드를 켤 수 있습니다.
- 키가 없으면 규칙 기반 해석으로 동작하고, 답변마다 "규칙 기반 데모 응답" / "LLM 해석 · 계산은 코드"로 구분해 표시합니다.
- 회사가 지정한 다른 AI 도구로 바꿀 때는 `src/ai/llm.ts`의 provider와 `server/index.mjs`의 `interpret()`만 교체하면 됩니다.

## 구조

| 계층 | 위치 |
|---|---|
| 데이터 | `src/data/` (타입, 업로드 필드 정의, 샘플) |
| 검색 | `src/lib/search.ts` |
| 분석 | `src/lib/metrics.ts`(납기·단가·재고 지표), `src/lib/evaluation.ts`(평가 점수), `src/lib/analysis.ts`(질문 유형별 분석) |
| AI | `src/ai/intent.ts`(규칙 해석), `src/ai/llm.ts`(LLM 연결), `src/ai/agent.ts`(질문 처리 흐름) |
| 템플릿 | `src/templates/registry.ts` + `src/components/templates/*` |
| UI | `src/App.tsx`, `src/components/*` |

평가 기준은 `src/lib/evaluation.ts`의 `EVAL_CONFIG`(가중치·등급 구간·관리 기준)만 바꾸면 됩니다. 현재 값은 **내부 평가 기준 예시 v0.1 (DEMO)**이며 ISO 9001 공식 점수가 아닙니다.

새 템플릿 추가: `registry.ts`에 등록하고 `ResultPanel.tsx`의 `RENDERERS`에 컴포넌트를 연결합니다. 챗봇 코드는 바꾸지 않아도 됩니다.

## 구현 완료

- A/B/C 3분할(30/40/30), 패널별 독립 스크롤, 1180px 이하에서 A/B/C 탭 전환
- 평가 카드: 등급 도넛, 5개 항목 막대, 항목별 계산 근거·데이터 출처·누락 항목, 처리 단계 상태
- 4개 데이터 탭: 검색·필터·정렬, 행 선택 시 상세, CSV/JSON 업로드·검증, 샘플 불러오기, 재계산
- 챗봇: 질문 의도 파악, 대상 누락 시 추가 질문, 선택한 품목·협력사 문맥 사용, 진행 상태, 데이터 출처 표시
- 키워드 검색: 협력사·품목·발주번호·계약·평가·납기 이력, 결과 클릭 시 A에서 선택
- 질문 유형 7종: 품목별 후보 업체, 납기 준수율 저조, 단가 상승, 등급별 품질 실적, 협력사 평가 근거, 협력사 비교, 재고·공급 위험
- 템플릿 추천과 C 생성 단계 분리, 템플릿 4종(비교표·차트·카드·보고서), 템플릿 전환 시 재분석 없음
- 후속 질문에서 직전 품목·업체 유지(예: 납기 우선), "현재 형식 유지" 선택지
- 단가는 같은 품목·규격·통화·인도조건끼리만 비교, 조건이 다르면 순위에서 제외하고 사유 표시
- 데이터 변경 시 "다시 분석" 안내, CSV 내보내기, 보고서 인쇄(로컬) / 보고서 HTML 저장(claude.ai)
- 업체 선정은 자동 확정하지 않음

## 미구현 · 한계

- 실제 사내 ERP·QMS API 연결 없음 (파일 업로드로 대체)
- 정성 평가 자동 생성 없음 — 면담에서 확인한 "기록된 데이터 그대로" 원칙에 맞춰 근거 설명만 만듭니다
- 기간 조건은 "최근 N개월/N년"만 해석, 복잡한 조건 조합(예: 품목 + 등급 + 기간 동시 필터)은 일부만 지원
- 사용자 권한·로그인, 서버 저장(업로드 데이터는 새로고침하면 샘플로 돌아감) 없음
- Vite·Tailwind·Recharts 대신 esbuild·직접 작성한 CSS·SVG 차트를 사용 (개발 환경에서 패키지 저장소에 접속할 수 없어 설치 가능한 범위로 구성)

## 테스트

```bash
npm run test:logic                # 분석 로직 스모크 테스트
npm start & npm run test:e2e      # 브라우저 E2E (Python Playwright 필요)
```

E2E는 명세서 6장 시나리오(질문 → 추가 질문 → 템플릿 추천 → 비교표 → 후속 질문)와 10장 검증 기준 46개 항목을 확인합니다.
