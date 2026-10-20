# 구매·협력사 데이터 연결 계약

이 인터페이스는 3D 배치 객체와 생산 호기별 구매 정보를 연결한다. PDF 분석, ERP 접근, 실재 업체 계약 조회, 가용재고 산정 또는 자동 부족량 계산은 수행하지 않는다. 기본 화면의 생산 호기는 `UNREGISTERED-001`이며 실제 생산 호기·품목·재고·발주 자료는 전부 미등록이다.

## 데이터의 성격

| dataKind | 의미 | 제약 |
| --- | --- | --- |
| `unregistered` | 실제 정보가 아직 제공되지 않은 초기 상태 | `supply`·`suppliers`는 빈 배열. 표시값은 ‘미등록’이며 상태는 회색 |
| `demo` | 가상의 동작 시연 | 호기·협력사 ID는 `DEMO-` 시작. 모든 협력사는 `fictional:true`. 실제 업체와 무관 |
| `registered` | 사용자가 명시적으로 가져온 실제 업무 데이터 | `sourceDescription` 필수. 협력사는 `fictional:false`. `DEMO-` 호기·협력사·품목·발주번호 사용 불가 |

`registered`는 자동으로 사실이 확인되었다는 의미가 아니다. 사용자가 제공한 원천의 성격을 나타내며, 정확성·최종 승인·데이터 갱신은 연결하는 업무 시스템의 책임이다. 실제 공급업체를 형상 참고자료의 회사명으로 자동 생성하지 않는다.

제공 JSON은 `public/data/procurement-empty.json`과 `public/data/procurement-demo.json`이다. 시연 파일은 외부 계약·재고·발주 시스템에서 가져온 데이터가 아니다. 날짜와 수량도 전부 가정이다.

## 식별자

`partId`는 3D 내 설치 위치·분류의 안정적인 ID다. 실제 `itemNumber`·`revision`과 구분한다. 동일 `partId`가 다른 호기에 존재할 수 있으므로 행의 키는 `(unitId, partId)`다. 같은 호기에서 키가 중복되면 가져오기를 거절한다.

예: `CYL01_LINER`, `CYL01_COVER`, `CYL01_EXHVALVE`, `CYL01_EXHVALVE_SPINDLE`, `CYL01_HYDPIPE_01`, `ENGINE_FRAMEBOX`, `ENGINE_BEDPLATE`, `ENGINE_MBS_01`.

기통 번호는 해당 호기의 `cylinders` 이내여야 한다. 기통 수를 바꾸면서 원래의 다른 품목번호·REV·협력사를 재사용한다고 추정하지 않는다. 같은 위치에 다른 정보를 입력하려면 해당 호기의 공급 행을 별도로 제공한다.

## 최상위 형식

```json
{
  "schemaVersion": "1.0",
  "dataKind": "unregistered",
  "notice": "실제 데이터 미등록",
  "units": [
    {
      "id": "UNREGISTERED-001",
      "label": "미등록 생산 호기",
      "cylinders": 6,
      "phase": "미등록",
      "dueDate": null
    }
  ],
  "suppliers": [],
  "supply": [],
  "purchasingPolicy": []
}
```

호기는 최소 1개 필요하며 기통 수는 1~24 정수다. 현재 6·7기통 시연은 반복 모듈 동작 검증용이며 특정 제작 엔진의 확정 사양이 아니다.

협력사 객체는 `{ "id": "USER-SUP-1", "name": "사용자 입력 업체", "fictional": false }` 형식이다. 실제 연결 데이터의 이름은 사용자가 제공해야 한다.

## 공급 행 필드

| 필드 | 자료형 / 의미 |
| --- | --- |
| `unitId` | 등록된 생산 호기 ID |
| `partId` | 3D 배치 ID. 대문자 영문·숫자·밑줄 |
| `itemNumber` | 실제 품목번호 또는 `null` |
| `revision` | 실제 REV 또는 `null` |
| `supplierId` | 등록된 협력사 ID 또는 `null` |
| `requiredQty` | 해당 행의 필요량 또는 `null` |
| `availableStock` | 요구 사양·사용 가능 여부를 확인한 가용재고 또는 `null` |
| `shortageQty` | 원천 시스템이 제공한 부족량 또는 `null` |
| `allocatedQty` | 이 호기에 배정한 수량 또는 `null` |
| `openOrderQty` | 미입고 발주 수량 또는 `null` |
| `purchaseOrder` | 발주번호 문자열 또는 `null` |
| `requiredDate` | 필요 입고일 `YYYY-MM-DD` 또는 `null` |
| `expectedDate` | 납품 예정일 `YYYY-MM-DD` 또는 `null` |
| `status` | `secured`, `review`, `shortage`, `unknown` 중 하나 |
| `reason` | 상태 사유. 없으면 ‘데이터 미확인’ |
| `updatedAt` | 갱신일 또는 시간. ISO 날짜 또는 시간대가 있는 ISO timestamp, 없으면 `null` |
| `procurementMode` | `assembly`, `individual` 또는 `null` |
| `parentPartId` | 동일 호기의 조립체 ID 또는 `null` |
| `bomIncluded` | BOM 집계 여부. 정보용 하위 부품은 `false` |

수량은 0 이상의 유한한 숫자만 허용하며, 빈 값과 0은 구분한다. 미등록을 0으로 바꾸지 않는다. 부족량은 `필요량 − 재고`로 단순 계산하지 않는다. 공용재고·호기 배정·입고시점·승인 상태가 확인되지 않았기 때문이다. 사용자 제공 숫자를 보존하며 상태도 재고 수치만으로 다시 판정하지 않는다.

날짜는 존재하는 달력 날짜여야 한다. `2026-02-30`처럼 형식만 날짜인 값도 거절한다. ID·상태·참조·수량·날짜·BOM 정책 중 하나라도 유효하지 않으면 전체 가져오기를 거절하며 일부 행을 조용히 누락하지 않는다. 입력 JSON 문자열은 20 MiB, 각 최상위 배열은 100,000행으로 제한한다.

## 상태 의미와 강조

| 상태 | 색상 | 업무 의미 |
| --- | --- | --- |
| `secured` | 초록 | 요구 사양·수량을 충족하는 사용 가능한 재고 확보 |
| `review` | 노랑 | 입고 예정·입고 지연·적용 승인 검토 등 확인 필요 |
| `shortage` | 빨강 | 필요일까지 확보할 대책이 없는 부족 상태 |
| `unknown` | 회색 | 데이터 미확인 |

색과 함께 `reason`을 표시한다. 초기 미등록 상태를 초록색으로 처리하지 않는다. 협력사 강조는 `getSupplierPartIds(dataset, 현재호기, supplierId)`가 반환한 **명시적인 공급 행**의 `partId`만 사용한다. 다른 호기에서 같은 업체가 공급하는 품목은 현재 호기의 공급 사실로 간주하지 않는다. 조립체 공급 사실을 모든 하위 부품의 개별 계약 사실로 복제하지 않는다.

## 조립체·개별 부품 BOM

배기밸브 상위 노드와 하위 `HOUSING`·`SPINDLE`·`SEAT`는 독립 ID를 유지한다. 컴플리트 구매일 때 상위 행만 집계하고 하위 행은 `parentPartId`를 지정한 `bomIncluded:false` 정보 행으로 제공한다. 하위 행에는 공급업체·품목번호·구매량을 자동 복사하지 않는다.

```json
{
  "purchasingPolicy": [
    {
      "unitId": "DEMO-0601",
      "assemblyPartId": "CYL01_EXHVALVE",
      "mode": "assembly"
    }
  ]
}
```

- `assembly`: 상위 공급 행의 `procurementMode`는 `assembly`다. 집계되는 조립체와 집계되는 하위 구매 행이 동시에 존재하면 오류다.
- `individual`: 상위 조립체 정보 행은 `bomIncluded:false`다. 실제 구매하는 하위 부품 행은 `procurementMode:individual`, `bomIncluded:true`로 등록한다.
- 하위 부품의 부모 누락·다른 기통을 부모로 지정·부모 순환·정책 충돌은 오류다.
- `buildBom`은 제외된 행을 `excludedChildren`으로 함께 반환하므로 조립 관계를 보존한 채 집계 제외 이유를 표시할 수 있다.
- MBS와 베어링 쉘의 ID는 다르게 유지한다. 현재 시연 데이터는 MBS·쉘을 실제 별도 구매 품목이라고 가정하지 않으며 공급 행이 없다.

## JavaScript 연결

`src/procurement.js`는 외부 라이브러리 없는 ES module이다.

```js
import {
  getDataset, validateDataset, getSupply, getSupplierPartIds,
  getEffectiveStatus, getUnitSummary, buildBom, exportDataset,
} from './src/procurement.js';

let dataset = getDataset(); // 기본값: 미등록 실제 데이터 인터페이스
const result = validateDataset(await file.text());
if (result.valid) dataset = result.dataset;
else showImportErrors(result.errors); // 기존 정상 데이터 유지

const row = getSupply(dataset, unitId, partId);
const highlightedIds = getSupplierPartIds(dataset, unitId, supplierId);
const jsonText = exportDataset(dataset);
```

함수는 모두 동기다. `getDataset`·`getSupply`는 반환 자료를 복사하므로 호출자가 기본 데이터를 오염시키지 않는다.

| API | 반환값 |
| --- | --- |
| `STATUS` | `{secured:{label,color}, review:{label,color}, shortage:{label,color}, unknown:{label,color}}` |
| `UNITS` | 기본 미등록 호기 목록 |
| `getDataset('empty' \| 'demo')` | 독립 복사된 기본 또는 시연 데이터 |
| `getSupply(dataset, unitId, partId)` | 해당 행 또는 수량·품목·일정이 `null`인 회색 기본 행 |
| `getSupplierPartIds(dataset, unitId, supplierId)` | 현재 호기의 중복 없는 `partId[]` |
| `getEffectiveStatus(dataset, unitId, partId)` | 상태 문자열. 누락된 부품은 `unknown` |
| `getUnitSummary(dataset, unitId, partIds)` | `{total, registered, unregistered, counts, secured, review, shortage, unknown}`. 등록 수는 품목번호 존재 기준 |
| `validateDataset(input)` | `{valid, errors, dataset}`. 실패하면 `dataset:null` |
| `buildBom(dataset, unitId)` | `{unitId, items, excludedChildren, totalRows, totalRequiredQty, notice}` |
| `exportDataset(dataset)` | 검증된 JSON 문자열. 유효하지 않으면 예외 |

`totalRequiredQty`는 모든 집계 행에 명시적인 필요량이 있을 때만 단순 합계다. 서로 다른 품목의 구매 수량 합계이며 가용재고·부족량·구매 금액이 아니다. 입력 행이 없거나 필요량이 누락되면 `null`이다. 이를 자재 확보율로 해석하지 않는다.

## 같은 출처의 화면 연결

독립 창은 JSON 파일 연결을 사용한다. 같은 origin의 부모 화면 안에 `index.html?embed=1` iframe으로 넣으면 `iframe.contentWindow.postMessage({type:'DOCK_LOAD_PROCUREMENT', dataset}, location.origin)`으로 명시적 데이터셋을 전달할 수 있다. 부모 창·origin이 모두 일치할 때만 입력을 처리하며 일반 JSON 업로드와 같은 전체 검증을 적용한다. 응답은 `DOCK_DATA_ACCEPTED` 또는 `DOCK_DATA_REJECTED`와 오류 사유다.

부품 선택 시 부모에게 `{type:'DOCK_PART_SELECTED',unitId,partId,dataKind}`를 같은 origin으로 전달한다. 배치 전용 모드의 `unitId`는 null이다. 이 이벤트는 기존 6G50 협의 ID를 자동 변환하거나 실제 발주를 갱신하지 않는다. 외부 창은 해당 이벤트의 origin/source도 검사해야 한다. 데이터는 브라우저 메모리에만 유지하며 인증·서버 저장·ERP 갱신은 별도 구현 범위다.

## 검증

```sh
node --test tests/procurement.test.mjs
```

검증 범위는 미등록의 `null` 보존, 데이터 복사 격리, 현재 호기만의 공급 강조, 상태별 집계, 조립체·하위 BOM 중복 방지, 날짜·수량·식별자·참조·순환 검증, 시연·실제 구분, 사용자 제공 실제 데이터 연결, JSON 내보내기 ID 보존과 정적 템플릿 일치다. 파일 내용만으로 실재 ERP·재고·계약 사실이 검증되었다고 주장하지 않는다.
