# 6G50ME-C9.6 3D 엔진 · 구매 기술협의 시연

기존 저장소 루트의 v0.1.0 구매 분석 앱과 독립된 프로젝트입니다. 원본 단일 HTML MAIN 01을 보존한 페이지와, React Three Fiber 기반 MAIN 02를 포함합니다. 루트 앱과 데이터/로그인을 통합한 상태는 아닙니다.

## 시연

https://hanwha-engine-dx-6g50-demo.knewyouknownewidea.chatgpt.site/

소유자 ChatGPT 계정 로그인이 필요합니다. 진입 후 계정 선택은 구매팀·기술부서·가상 협력사의 업무를 확인하기 위한 시연 기능입니다. 실제 기업 사용자 인증이 아닙니다.

## 주요 기능

- 6기통 전체 94개 독립 CAD 객체와 연속된 공통 크랭크축
- 외형/내부 단면, 회전·확대·이동, 부품 선택·강조·부품군 표시
- 모델 아래 '분리' 슬라이더로 분리 표시, 0% 또는 초기화로 재조립
- 부품·기통 ID와 협의 기록 연결, 검색 및 상태 필터
- 문의 등록, 부서 배정, 부서별 검토, 구매팀 최종 회신, 협력사 확인
- 구매 후속 조치 5종과 최종 완료 조건, 감사 이력
- SQL(D1/로컬 SQLite) 저장과 R2 첨부, 서버 측 시연 역할·업체 범위 검사
- 가상 협의 10건, 실제 자료와 가정·가상 데이터 구분

## 실행

Node.js >=22.13, pnpm 11.25를 사용합니다. 저장소 루트가 아니라 이 폴더에서 실행하세요.

```sh
cd engine-dx
pnpm install --frozen-lockfile
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_tearful_catseye.sql
pnpm dev --hostname 127.0.0.1 --port 5174
```

마이그레이션은 새 로컬 DB에 한 번만 적용합니다. 루트 앱의 기본 5173 포트와 구분하기 위해 예시에서는 5174를 사용합니다. 로컬 DB/버킷은 무시된 `.wrangler/state`에 저장됩니다. API 키 없이 동작합니다.

## 검증

```sh
node checks/backend.mjs
node node_modules/typescript/bin/tsc --noEmit
```

17개 백엔드/매핑 검사, CAD 간섭 결과 및 브라우저 확인 화면은 `verification/`, `cad/validation.json`에 포함됩니다. 기존 MAIN 01 보존 검사는 원본 SHA256을 비교하므로 외부 작업 폴더에 의존하지 않습니다.

## 구성

| 경로 | 내용 |
|---|---|
| `app/` | MAIN 02, R3F 뷰어, API 라우트 |
| `lib/` | 업무 규칙, 서버 API, 가상 시나리오 |
| `db/`, `drizzle/` | SQL 스키마와 마이그레이션 |
| `public/models/` | 실제 웹에서 읽는 GLB와 부품 JSON |
| `public/main01/` | 이전에 제공된 MAIN 01 원본 HTML |
| `cad/STEP/`, `cad/GLB/` | 전체/절개 CAD, 단계별 STEP |
| `cad/src/`, `cad/checks/` | Text-to-CAD 형상 소스와 검증 코드 |
| `cad/dimensions.json` | 공개 확인·파생·가정 치수 및 경계 |
| `verification/` | 검증 결과와 시연 화면 |
| `사용안내.txt` | 조작법, 실행법과 한계 |

공식 Text-to-CAD/cadgen 0.7.21로 CAD를 생성했습니다. CAD 재생성에는 해당 별도 Python 도구가 필요합니다. 웹 실행에는 미리 생성된 GLB를 사용합니다.

## 배포 및 한계

Vinext/Vite, Cloudflare D1·R2 바인딩을 사용합니다. `.openai/hosting.json`에는 바인딩 선언만 포함하며 기존 개인 사이트의 project_id는 제외했습니다. 새 Sites 배포 시 자신의 프로젝트를 등록해야 합니다. 프레임워크 기반 안내는 `README.starter.md`를 참고하세요.

모든 계정·협력사·협의·발주 데이터는 가상입니다. 보어 500mm/행정 2500mm는 공개 가족 기준이며 나머지 형상과 주요 치수는 개략 가정입니다. 제조사 원본 CAD, 제작 도면, 실제 고장 기록, 검증된 공급관계가 아닙니다. 저장된 한 자세의 정적 간섭 검사만 수행했습니다. 운영용 SSO, 실제 업체 소속 인증, 악성 첨부 검사 및 ERP·MES·PLM 연동은 별도 과제입니다.
