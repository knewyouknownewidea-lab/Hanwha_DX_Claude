# 선박 저속엔진 부품 구매 뷰어

구매 담당자가 생산 호기별 부품 위치와 공급·자재 정보를 확인하는 웹 모듈입니다. 라이너·커버·프레임박스·베드플레이트·배기밸브·유압 배관·MBS를 독립 객체로 선택하고, 선택 호기에 실제로 연결한 협력사의 부품만 상태 색상으로 강조합니다.

> **구조 설명용 모델 / 실제 제작 치수 아님**
>
> 기준 계열은 MAN B&W G95ME-C이며 공식 11G95ME-C Mark 10.5 포스터의 구조를 참고했습니다. 모든 생성 메시의 치수·두께·간격은 단위 없는 개념 비례입니다. 확인된 부품 제작 치수는 적용하지 않았습니다.

## 실행

Node.js 22 이상에서 이 폴더를 작업 디렉터리로 사용합니다.

```sh
npm install
npm run export
npm test
npm run build
npm start
```

[로컬 뷰어 열기](http://localhost:5178). 서버는 `127.0.0.1:5178`에서 정적 결과물을 제공합니다. 포트를 변경하려면 `PORT` 환경변수를 지정합니다. Three.js는 빌드 결과에 포함되어 화면 실행 중 CDN을 요청하지 않습니다. 최신 소스·모델 수정 후에는 `npm run export`와 `npm run build`를 다시 실행합니다.

실제 브라우저 시연 화면과 짧은 영상은 다운로드 패키지의 `verification/`에 포함했습니다. 비공개 호스팅은 Git 전송용 표준입력 전달을 실행 환경이 자동 거부해 미완료입니다. 새 사이트 ID만 생성되었으며 배포된 주소로 안내하지 않습니다. 로컬 뷰어는 위 명령으로 실행할 수 있습니다.

## 시연 흐름

1. 첫 화면은 **실제 데이터 미등록**입니다. 회색은 데이터 미확인이며 품목·업체·수량·발주·일정은 ‘미등록’으로 표시합니다.
2. **시연 데이터 켜기**를 누르고 `DEMO-` 생산 호기를 선택합니다. ‘시연 협력사 A/B/C’와 수량·재고·발주·일정은 모두 가상입니다.
3. 협력사를 선택하면 현재 호기에 명시적으로 연결된 `partId`만 강조하고 주변 형상은 반투명하게 표시합니다. 초록=확보, 노랑=확인 필요, 빨강=미확보, 회색=미확인입니다. 상세 정보에 상태 사유도 표시합니다.
4. 부품 메시 또는 목록을 선택하면 품목번호·REV·공급업체·수량·재고·배정·발주·입고 일정·갱신일·정확도·출처가 표시됩니다. ‘조립체 하위품·보조 객체’를 켜면 밸브 하위품과 쉘도 탐색할 수 있습니다.
5. **단면** 또는 **연결 분리**로 내부 위치를 확인합니다. **천천히 점멸**을 해제하거나 **모션 감소**를 켜 밝기 변화를 멈춥니다. 운영체제의 `prefers-reduced-motion`도 반영합니다.
6. **GLB**, **객체 JSON**, **BOM JSON**, **화면 PNG**를 저장할 수 있습니다. **시연 종료 · 미등록으로**를 누르면 빈 업무 데이터로 돌아갑니다.

점멸은 약 1.8초 주기의 완만한 밝기 변화이며 형상이 완전히 사라지지 않습니다. 투명 문맥 객체가 내부 부품 선택을 막지 않도록 선택 후보를 따로 관리합니다. 반복 부품의 재질을 독립 소유해 한 기통의 강조가 다른 기통 재질을 변경하지 않게 합니다.

단면은 내부 위치를 보기 위한 열린 화면 절단입니다. 실제 제작 단면·냉각유로·밀봉 구조를 뜻하지 않습니다. 연결 분리는 식별을 위한 배치 보조이며 실제 정비 순서나 탈착 가능성을 지시하지 않습니다. 특히 **MBS는 베드플레이트 내 통합 지지영역**으로 취급해 분해 이동하지 않습니다. 별도 MBS 파일은 식별과 데이터 연결을 위한 것입니다.

## 부품별 편집 원본과 파일명

| 부품 | 반복 수정 가능한 JavaScript 원본 | 개별 웹 모델 |
|---|---|---|
| 실린더 라이너 | `src/models/cylinder-liner.js` | `public/models/cylinder-liner.glb` |
| 실린더 커버 | `src/models/cylinder-cover.js` | `public/models/cylinder-cover.glb` |
| 프레임박스 | `src/models/frame-box.js` | `public/models/frame-box.glb` |
| 베드플레이트 | `src/models/bedplate.js` | `public/models/bedplate.glb` |
| 배기밸브 조립체 | `src/models/exhaust-valve-assembly.js` | `public/models/exhaust-valve-assembly.glb` |
| 배기밸브 하우징 | 위 조립체 파일 내 독립 객체 | `public/models/exhaust-valve-housing.glb` |
| 배기밸브 스핀들 | 위 조립체 파일 내 독립 객체 | `public/models/exhaust-valve-spindle.glb` |
| 배기밸브 시트 | 위 조립체 파일 내 독립 객체 | `public/models/exhaust-valve-seat.glb` |
| 유압 배관 | `src/models/hydraulic-pipe.js` | `public/models/hydraulic-pipe.glb` |
| 메인베어링 서포트 | `src/models/main-bearing-support.js` | `public/models/main-bearing-support.glb` |
| 베어링 쉘 | 위 서포트 파일 내 별도 보조 객체 | `public/models/bearing-shell.glb` |
| 실린더프레임 | `src/models/cylinder-frame.js` | `public/models/cylinder-frame.glb` |

공통 구조·반복 조립 원본은 `src/engine-scene.js`, 피스톤·크로스헤드·축 등 위치 설명용 형상은 `src/models/context-parts.js`입니다. 부품은 단일 메시로 합치지 않고 상위 조립체와 하위 ID를 유지합니다.

내보내기는 **GLB 15개**(위 개별 12개 + `engine-6.glb`, `engine-7.glb`, `engine-11.glb`), **부품별 SVG 참고도 12개**, `public/data/parts-manifest.json`을 생성합니다. [부품 참고도 목록](./public/reference/index.html)에서 정면·측면·개념 단면을 확인할 수 있습니다. 참고도에는 근거 없는 실제 치수선이 없습니다.

`createEngine(cylinderCount)`는 2~12기통의 개념 반복 배치를 지원하며 UI는 6·7·11기통을 제공합니다. 기통 수가 바뀌어도 개별 라이너·커버 형상을 늘려 변형하지 않습니다. 프레임·베드는 반복 수에 맞는 개념 구조를 다시 생성합니다. 선택 호기와 기통 수가 달라지면 구매 데이터 표시를 해제해 다른 배치에 기존 정보를 잘못 붙이지 않습니다.

## 데이터 연결

[데이터 계약](./docs/data-contract.md)에 JSON 형식과 검증 규칙을 정리했습니다. **JSON 연결**은 사용자가 선택한 로컬 파일을 브라우저에서 읽고 검증하며 서버로 업로드하지 않습니다. 실제 재고 계산·PDF 분석·계약 조회·ERP/MES/PLM 동기화는 포함하지 않습니다.

- 3D 위치 ID인 `partId`와 실제 `itemNumber`·`revision`을 구분합니다. `(unitId, partId)`에 호기별 품목·공급사·발주를 연결합니다.
- 실제 자료는 `dataKind: "registered"`와 원천을 설명하는 `sourceDescription`을 요구합니다. 시연 데이터는 `dataKind: "demo"`, `DEMO-` ID, `fictional: true`로 구분합니다.
- 값이 없으면 `null`을 유지하고 화면에 ‘미등록’으로 표시합니다. 재고 수량으로 상태를 임의 계산하지 않으며 실제 상태·수량은 입력 원천의 값을 표시합니다.
- `purchasingPolicy`의 `assembly` 모드는 컴플리트를 집계하고 정보용 하위품은 `bomIncluded: false`로 제외합니다. `individual` 모드는 개별 부품만 집계하고 상위 조립체를 제외합니다. 중복 구매·순환 부모·다른 기통 부모 연결은 검증에서 거부합니다.

초기 양식은 `public/data/procurement-empty.json`, 가상 예시는 `public/data/procurement-demo.json`, 출처 목록은 `public/data/sources.json`입니다. 공식 사진의 업체를 선택 호기의 실제 공급업체로 자동 등록하지 않습니다.

## 기존 프로젝트 연결

대상은 `knewyouknownewidea-lab/Hanwha_DX_Claude`입니다. 기존 루트 앱과 `engine-dx`의 MAIN 01·MAIN 02·기술협의·기존 6G50 모델을 유지하고 별도 부품 구매 메뉴를 추가합니다.

| 기존 저장소 안의 추가 위치 | 용도 |
|---|---|
| `engine-dx/parts-viewer/` | 이 모듈의 소스·모델·검증·문서 |
| `engine-dx/public/parts-viewer/` | `npm run build` 결과를 복사한 정적 웹 모듈 |
| `engine-dx/app/Workspace.tsx` | 기존 메뉴를 유지하며 ‘부품 구매’ 진입 링크 추가 |
| `/parts-viewer/index.html` | 기존 웹 서버에서 여는 새 모듈 경로 |

기존 `engine-dx`의 dev/build 명령은 `parts-viewer/scripts/integrate.mjs`를 먼저 실행해 이 모듈의 GLB·참고도·정적 페이지를 생성합니다. `npm run parts:build`로 해당 생성만 실행할 수도 있습니다. GitHub에는 부품별 원본과 생성 스크립트를 저장하고, 생성된 GLB·SVG·vendor는 다운로드 패키지에 포함합니다.

기존 MAIN 02의 6G50ME-C9.6과 이 G95 모듈은 서로 다른 모델입니다. ID·품목·업무 데이터를 추정으로 자동 변환하지 않습니다. 자세한 경계는 [기존 프로젝트 연결 기록](./docs/기존프로젝트-연결.md)을 참조합니다.

## 검증과 자료 경계

[완료·검증 보고서](./docs/acceptance-report.md), [출처·라이선스·정확도](./docs/sources-and-accuracy.md), [모델 구조·단위·원점](./docs/modeling.md), [외부 코드 고지](./THIRD_PARTY_NOTICES.md)를 제공합니다.

정밀 제조 CAD·STEP·승인 제작도면을 생성하지 않았습니다. 편집 가능한 원본은 독립 작성한 절차적 시각화 메시 소스입니다. 실제 호기 설계 검증에는 제조사 승인 도면·BOM·배관 라우팅과 사용 권한이 필요합니다. 외부 후보 CAD·GLB·타사 뷰어 코드·공식 원문 사진·PDF는 포함하지 않았습니다.

이 작업에서 기존 사용자 코드나 새 모듈에 별도의 오픈소스 라이선스를 임의 부여하지 않았습니다. 외부 코드의 라이선스는 별도로 유지하며, 프로젝트 배포 권한과 라이선스 선택은 기존 권리자에게 있습니다.
