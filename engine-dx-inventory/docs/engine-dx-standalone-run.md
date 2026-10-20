# engine-dx 독립 실행 방법 (이 PC에서 검증함)

위치: `C:\Temp\engine-dx-repo\src\engine-dx` (저장소 루트가 아니라 이 폴더에서 실행)

## 필요 환경
- Node >= 22.13 (이 PC: v24.21.0)
- pnpm 11.25.0 (이 PC에는 설치돼 있지 않음. 전역 설치 없이 `npx --yes pnpm@11.25.0 ...` 사용)

## 최초 1회
```sh
cd C:\Temp\engine-dx-repo\src\engine-dx
npx --yes pnpm@11.25.0 install --frozen-lockfile
npx --yes pnpm@11.25.0 build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_tearful_catseye.sql
```
세 번째 줄(로컬 DB 마이그레이션)은 새 DB에 한 번만 실행합니다.

## 실행
- 개발 모드: `npx --yes pnpm@11.25.0 dev --hostname 127.0.0.1 --port 5174` -> http://127.0.0.1:5174/
  (첫 접속 시 Vite 의존성 최적화로 몇 초 걸림)
- 빌드 결과 실행(권장, 더 빠름): `npx --yes pnpm@11.25.0 build` 후 `npx --yes pnpm@11.25.0 start` -> http://127.0.0.1:8787/
- MAIN 01(단일 HTML): 위 서버의 `/main01/index.html`

## 종료
실행한 터미널에서 Ctrl+C. 백그라운드로 띄웠다면 해당 포트(5174 또는 8787)를 쓰는 프로세스를 종료
(`netstat -ano | findstr :5174` 후 `taskkill /PID <PID> /T /F`).

## 알려진 문제
- 첫 화면 로드 때 콘솔에 `/api/me` 401이 한 번 보임: 로그인 전 확인 요청이며 곧바로 시연 세션이 자동 생성돼 정상입니다.
- MAIN 01 접속 시 `/api/ai/status` 404가 한 번 보임: MAIN 01의 AI 상태 조회용으로 이 프로젝트엔 해당 API가 없고, 화면 동작에는 영향이 없었습니다(추정: 원본 단일 HTML이 루트 앱의 서버를 가정).
- MAIN 01을 `file://`로 직접 열기: 스크립트가 모두 인라인이라 서버 없이 열 수 있는 구조지만, 브라우저 창에서는 정적 스냅샷으로만 열려 동작은 확인하지 못했습니다. 폰트는 Google Fonts에서 받으므로 오프라인이면 기본 글꼴로 보입니다.
- 번들 크기 경고(500 kB 초과 청크)는 무시해도 됩니다.
- 로컬 데이터는 `.wrangler/state`에 저장됩니다. 초기화하려면 이 폴더를 지우고 마이그레이션을 다시 실행하세요.

## 이번에 허용한 postinstall 패키지
새로 허용한 것은 없습니다. 저장소의 `pnpm-workspace.yaml`에 이미 `allowBuilds`로 esbuild, sharp, unrs-resolver, workerd가 허용돼 있었고, 설치는 그대로 성공했습니다.

## 수정한 소스
없음. 생성물만 추가됨: `node_modules/`, `dist/`, `.wrangler/`.

## 3D가 안 보일 때
- 브라우저가 WebGL을 지원하는지 확인: `chrome://gpu` 에서 WebGL이 "Hardware accelerated" 또는 "Software only"인지 확인.
- 크롬/엣지의 "하드웨어 가속 사용"을 켜고 브라우저를 다시 시작.
- 개발자 도구 콘솔에 WebGL context 오류가 있는지, `/models/engine_cutaway.glb` 요청이 200인지 확인.
- 원격 데스크톱·가상 머신에서는 WebGL이 꺼져 있을 수 있음.

## 재고 화면 변경(이번 수정)
**바뀐 화면** (MAIN 02): 제목 "엔진 부품 재고"(경로 `MAIN 02 > ENGINE PARTS INVENTORY`, 헤더 라벨 "부품 재고"). 기술협의 등록 버튼·협의 탭·카드·상세·시연 계정 select·"기록 저장 연결"·협의 등록 모달을 화면에서 제거했습니다. 요약 띠는 "재고 품목(부품 유형) N종", "안전재고 미달 세부 항목 N건"으로 바뀌었습니다. 우측 패널은 부품을 선택하면 재고 요약(유형 총 재고·세부 항목 수·기준일)과 세부 항목 목록(도면번호·개정·재질·재고·안전재고·창고, "안전재고 미달"·"이 위치 적용" 배지, 접기/펼치기)을 보여 줍니다. 부품 이름·ID 검색은 유지됩니다. 재고는 같은 부품 유형 전체(6개 기통 공통) 합계입니다.

**새 파일**
- `public/data/inventory.json`: 재고 데이터. 서버 API 없이 `fetch('/data/inventory.json')`로 읽습니다.
- `checks/inventory.mjs`: 위 파일 검증(`node checks/inventory.mjs`, Node 표준 라이브러리만).
- 부품 목록도 이제 `/api/catalog`가 아니라 정적 `/models/parts.json`을 읽습니다(로그인·세션·/api 호출 없음).

**데이터 구조**: `{"meta":{"as_of","sample":true,"note"},"types":{"<part_type_id>":{"variants":[{"variant_id","drawing_no","rev","material","stock_qty","safety_stock","unit","warehouse","used_by":["<부품 id>"]}]}}}`. `used_by`는 parts.json의 부품 id이며, 비어 있으면 예비 재고입니다.

**가상 데이터 고지**: 모든 수량·도면번호(`SMP-...` 가상 형식)·재질·창고는 가상 SAMPLE이며 실제 자료가 아닙니다. 화면에 "SAMPLE · 가상 재고 · 실제 자료 아님 · 기준일 2026-10-23"을 표시합니다.

**8787 서버 반영**: `pnpm build` 후 서버 재시작이 필요합니다. 8787 서버(wrangler)가 `dist`를 잡고 있으면 빌드가 `EPERM`으로 실패하므로, 서버를 먼저 종료한 뒤 `npx --yes pnpm@11.25.0 build`, 이어서 `npx --yes pnpm@11.25.0 start`를 실행하세요.

## 협력사 강조(이번 수정)
**새 파일**
- `public/data/suppliers.json`: 가상 협력사 5곳(`SUP-DEMO-A`~`E`, 이름 "가상 협력사 A~E"). 구조 `{"meta":{"as_of":"2026-10-23","sample":true,"note":"가상 협력사·평가 값. 실제 평가 아님"},"suppliers":[{"supplier_id","name","grade","on_time_rate_pct","scope"}],"supply":{"<supplier_id>":["<part_type_id>",...]}}`. 등급(A/B/C)·납기 준수율(소수 첫째 자리)은 고정 가상값이며 실제 평가가 아닙니다. 협력사 A는 CONROD 등 운동부 7종을 담당하고, CONROD·LINER·PISTON은 두 곳이 함께 담당합니다. 29종 유형은 모두 최소 1곳이 담당합니다. 서버 API 없이 `fetch('/data/suppliers.json')`로 읽습니다.
- `checks/suppliers.mjs`: 위 파일 검증(`node checks/suppliers.mjs`).

**바뀐 파일**: `app/EngineViewer.tsx`, `app/Workspace.tsx`, `app/workspace.css`(끝의 `/* 협력사 강조 (v-supplier) */` 블록).

**새 props**: `EngineViewer`에 선택적 `highlightIds?: string[]`. 비어 있으면 기존 동작과 같습니다. 비어 있지 않으면 목록 부품은 초록(#19c37d) 발광으로 약 1.4초 주기 반짝이고(emissiveIntensity 0.25~1.0, 재질 참조 재사용), 나머지는 반투명 0.18입니다. 선택 부품은 주황 선택 강조가 우선이고, 강조 모드에서는 '주변 반투명' 체크보다 강조 규칙이 우선합니다. `prefers-reduced-motion: reduce`이면 반짝임 없이 고정 발광 0.7입니다.

**화면**: 3D 패널 도구줄 아래 '협력사 강조' 선택 칸(끄기 + 5곳, "가상 협력사 A · 담당 N종")과 해제 버튼, 3D 위 안내("… 담당 부품 N개 강조 중 · 나머지 반투명" + 강조 해제). 부품을 선택하면 오른쪽 재고 요약 아래에 '생산 협력사' 목록(이름, '평가 A' 배지, 납기 준수율 %, '이 협력사 부품 3D에서 강조' 버튼, 강조 중이면 '강조 중' 표시)과 "SAMPLE · 가상 평가값 · 실제 평가 아님 · 기준일" 고지가 나옵니다. 3D 빈 곳 클릭은 선택만 해제하고 강조는 유지합니다.

**테스트용 디버그 훅**: `window.__engineDx = {highlighted: string[], selected: string|null}`(읽기 전용, 환경 구분 없이 항상 존재), `.canvas-wrap`의 `data-highlight-count="N"`. 목록 행은 `data-testid="sup-row"`.

**검증 환경**: 개발 서버 5175에서 확인했고 8787 서버는 건드리지 않았습니다. 8787에 반영하려면 서버 종료 후 `build`와 `start`가 필요합니다.
