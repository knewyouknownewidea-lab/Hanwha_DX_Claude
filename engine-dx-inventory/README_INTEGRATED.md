# 엔진 부품 재고 · 부품 모델 통합본

`engine-dx-inventory`의 UI와 재고·협력사 기능에 앞서 제작한 부품별 3D 형상을 연결했습니다. 기존 HANWHA ENGINE 헤더, MAIN 01·MAIN 02 탐색, 3D·재고 2열 구성, 부품 검색, 유형 공용 재고와 세부 항목, 협력사 평가·납기 표시를 유지합니다. 선택 호기의 구매 정보는 펼쳐서 확인할 수 있습니다.

**구조 설명용 모델 / 실제 제작 치수 아님.** MAN B&W G95ME-C 계열의 공개 구조자료를 참고한 개념 형상입니다. 6·7기통은 반복 배치 시연이며 승인된 실제 엔진 구성을 뜻하지 않습니다. 사용자 요청에 따라 기본 화면을 **가상 데이터 프로토타입**으로 엽니다. 실제 구매·재고·공급 자료는 등록되어 있지 않습니다.

## 실행

다운로드 ZIP에는 실행 가능한 `dist`가 들어 있습니다. 압축을 푼 폴더에서 `node scripts/serve-static.mjs`를 실행하면 의존성 설치 없이 5179에서 열립니다. 아래 설치 절차는 소스 수정·재빌드 또는 GitHub에서 소스만 받은 경우에 사용합니다.

Node.js 22.13 이상과 npm이 필요합니다. 저장소의 `engine-dx-inventory` 디렉터리에서 실행합니다.

```text
node scripts/setup-preview.mjs
npm run preview:build
npm run preview:serve
```

미리보기 주소는 `http://127.0.0.1:5179/`입니다. 설치 스크립트는 `package.preview.json`에 명시한 최소 의존성을 `.preview-runtime`에 설치하고, 프로젝트에 `node_modules`가 없을 때 연결합니다. 기존 프레임워크 의존성 및 `pnpm-lock.yaml`을 교체하지 않습니다. 별도 의존성 경로를 사용할 때는 `INTEGRATED_NODE_MODULES`에 해당 `node_modules` 절대 경로를 지정할 수 있습니다.

```text
npm run parts:export
npm run test:parts
npm run typecheck:parts
npm run test:simulation
npm run static:build
```

`parts:export`는 기통 수별 GLB와 ID 매핑, 부품 참고도를 생성합니다. `preview:build`는 내보내기 후 `local-dist`를 만들고, `static:build`는 같은 Workspace를 `dist`에 빌드합니다. 미리보기 빌드는 브라우저 전용 `next/dynamic`을 `React.lazy`로 연결하며 동일한 `app/Workspace.tsx`를 직접 사용합니다. `esbuild-wasm`으로 제한된 Windows 환경에서도 표준 모듈 해석을 유지합니다.

원래 Vinext 개발·빌드 명령은 남겨 두었습니다. 이 작업에서 실행한 것은 별도 최소 의존성의 정적 미리보기·정적 배포용 빌드입니다. 전체 Vinext·Cloudflare 서버 빌드를 검증했다는 의미는 아닙니다.

## 시연 흐름

1. 처음부터 가상 6기통 호기 A로 열립니다. 가상 협력사 5곳·품목 24개·객체 연결 138개를 포함합니다. `데이터`에서 미등록 모드로 전환할 수도 있습니다.
2. 6기통 A 또는 7기통 B를 선택하고, 협력사 카드나 선택 상자에서 가상 협력사를 고릅니다. 같은 위치도 호기에 따라 품목·REV·공급업체가 달라집니다.
3. 부품을 클릭하거나 목록·검색으로 선택합니다. 유형 공용 재고와 해당 호기의 필요량·가용재고·배정량을 구분해 확인합니다.
4. 협력사를 선택하면 현재 호기의 명시적 공급 ID만 상태색을 유지하며 천천히 점멸합니다. 다른 부품은 상태색을 제거한 회색 반투명 재질로 표시하고 내부 부품을 클릭할 수 있습니다. 다른 협력사 카드의 색 점도 회색으로 바뀝니다. 강조를 해제하면 전체 부품의 원래 상태색을 복원합니다.
5. 점멸 정지·모션 감소, 부품군 숨김, 선택 부품만 보기, 단면·분리, 전체 초기화를 실행할 수 있습니다.
6. `시나리오`에서 기본·예정 물량 입고·협력사 납기 지연·입고검사 부적합을 전환합니다. 예를 들어 A호기 5번 라이너는 입고 후 확보로, 5번 커버는 검사 부적합 시 미확보로 바뀝니다. 시나리오는 원본에서 다시 계산하므로 입고나 부적합이 누적되지 않습니다.
7. `가상 데이터 보기`에서 재고·3D 매핑·품목·협력사·발주 및 입고·입고검사·생산계획 및 BOM의 7개 표를 검색합니다. 매핑의 부품 ID를 누르면 3D에서 선택합니다.
8. GLB·호기 BOM·현재 시나리오 JSON을 내려받을 수 있습니다. 사용자 JSON은 검증을 통과한 경우 브라우저에서 연결합니다.

초록은 확보, 노랑은 확인 필요, 빨강은 미확보, 회색은 미확인 또는 독립 구매 대상 아님입니다. 상태 사유를 함께 표시합니다. 현재 기본 시연 데이터는 이번 요청을 위해 독립 생성한 SAMPLE이며, 실제 업체 평가·재고·품목번호·발주·납기가 아닙니다. 재고에서 검사 부적합 보류량을 제외하고 위치별로 배정하는 단순 시뮬레이션입니다. [가상 데이터 구성과 계산](docs/prototype-data.md)을 참고하세요.

## 부품 원본과 연결

| 부품 | 반복 수정용 형상 원본 |
|---|---|
| 실린더 라이너 | `lib/engine-model/models/cylinder-liner.js` |
| 실린더 커버 | `lib/engine-model/models/cylinder-cover.js` |
| 프레임박스 | `lib/engine-model/models/frame-box.js` |
| 베드플레이트 | `lib/engine-model/models/bedplate.js` |
| 배기밸브 하우징·스핀들·시트 | `lib/engine-model/models/exhaust-valve-assembly.js` |
| 유압 배관 | `lib/engine-model/models/hydraulic-pipe.js` |
| 메인베어링 서포트 | `lib/engine-model/models/main-bearing-support.js` |
| 실린더 프레임 | `lib/engine-model/models/cylinder-frame.js` |
| 쉘·축 등 위치 설명용 보조 형상 | `lib/engine-model/models/context-parts.js` |
| 전체 조립·기통 반복 | `lib/engine-model/engine-scene.js` |

6기통에는 64개, 7기통에는 74개의 선택 ID가 있습니다. 이 개수는 구매 필요량이 아닙니다. MBS와 베어링 쉘은 다른 객체이며, 이 개념 모델의 MBS는 베드플레이트 통합 지지 영역으로 표현합니다. 배기밸브 조립체와 하위품의 계층은 유지하고 구매 정책에 따라 BOM 중복을 제외합니다.

앞선 작업에서 가져온 것은 형상 원본 11개입니다. 앞선 DOCK 화면과 구매 데이터는 가져오지 않았습니다. 기존 UI 스타일시트 3개와 MAIN 01 HTML은 원본과 해시가 같습니다. 비교 결과는 [통합 출처 검증](verification/integration-provenance.json)에 기록했습니다.

## 검증 결과

2026-10-20 다음 검증을 실행했습니다.

| 검증 | 결과 |
|---|---|
| 최소 의존성 설치 및 미리보기·정적 빌드 | 성공 |
| 통합 TypeScript 검사 | 통과 |
| 형상·GLB·객체 구조 | 8개 통과 |
| 재고·호기 공급·BOM 데이터 | 17개 통과 |
| 가상 데이터 관계·재고 배정·시나리오 | 11개 통과 |
| 실제 브라우저 UI·3D·가상 데이터 시뮬레이션 | 30개 통과 |
| 기존 백엔드 회귀 | 17개 통과 |
| 기존 재고 회귀 | 362개 통과 |
| 기존 협력사 회귀 | 55개 통과 |

브라우저 검증에는 실제 캔버스 클릭, 반투명 주변 뒤 라이너 선택, 정확한 호기별 공급 강조, 상태색·점멸·정지·모션 감소, 6→7기통 변경, GLB ID·BOM 다운로드, 잘못된 JSON 거부, 390px 화면의 가로 넘침 확인이 포함됩니다. 새 가상 협력사 카드, 7종 테이블·검색·키보드 조작, 다른 호기의 매핑 행에서 3D 선택, 입고·지연·부적합에 따른 수량·일정·상태 변화와 원본 복귀도 확인했습니다. JavaScript 오류와 실패한 자산 요청은 없었습니다. [브라우저 검증 기록](verification/integrated-browser.json), [전체 검증 범위](docs/integration-verification.md)를 참고하세요. 최신 실제 화면 시연 영상과 캡처는 로컬 결과물의 `verification`에 포함했습니다.

## 현재 한계와 배포 상태

로컬 뷰어는 `http://127.0.0.1:5179/`에서 동작하며 정적 배포용 `dist`를 생성할 수 있습니다. 비공개 호스팅은 완료되지 않았습니다. 이번 실행 환경의 자동 승인 정책이 Sites 소스 동기화 도구에 전달하는 Git 표준입력을 거부하여 게시 단계가 막혔습니다. 공개 접속 주소는 발급되지 않았습니다.

Headless WebGL 소프트웨어 렌더링으로 UI를 검증했습니다. 실제 제조 치수·승인 도면, ERP·MES·PLM, 실제 계약·재고·협력사 평가, 전체 Vinext·Cloudflare 서버/API 배포는 검증 대상에 포함되지 않습니다. MAIN 01은 기존 정적 원본을 보존했으며, LLM이나 새로운 서버 API를 연결하지 않았습니다.

실제 운영 연결에는 승인된 호기별 BOM, 품목번호·REV·공급 계약, 수량·납기 원천, 구매 단위 정책과 부품 적용·치수 자료가 필요합니다. 연결 형식과 미등록·가상·사용자 자료의 구분은 [데이터 계약](docs/model-data-integration.md)을 따릅니다.

저장소 적용 대상은 기존 `engine-dx-inventory` 경로입니다. 로컬 결과물 폴더명 `engine-dx-integrated`는 기존 저장소의 별도 앱 경로를 뜻하지 않습니다. 통합 변경은 기능 브랜치와 PR로 검토하고 main 원본을 보존하는 방식으로 전달합니다.
