# 부품 모델·재고 UI 통합 데이터 계약

이 통합본은 기존 `engine-dx-inventory`의 화면 구성을 유지하면서, 독립 제작한 `lib/engine-model/engine-scene.js`와 `models/*`의 부품 형상으로 교체한다. 최신 기본 시연은 사용자 요청에 따라 독립 생성한 `prototype-simulation.json`이다. 기존 `public/models/parts.json`, `public/data/inventory.json`, `public/data/suppliers.json`은 참조용 원본으로 보존한다. 원본의 `used_by` 및 협력사 공급 분류는 새 부품의 적용·장착·공급 관계로 사용하지 않는다.

**모델: MAN B&W G95ME-C 구조 설명용 모델 / 실제 제작 치수 아님.** 6·7기통은 반복 배치 시연이며 승인된 실제 제품 구성을 뜻하지 않는다. 수치 좌표는 무차원 비례이다. 새 모델에 기존 6G50 시연 데이터의 품목이 실제로 맞는다는 근거는 없다.

## 기본 상태와 시연 상태

- **현재 기본값:** `public/data/prototype-simulation.json`. `meta.dataKind="demo", sample=true`. 가상 호기 2개·협력사 5곳·품목 24개·3D 매핑 138개와 첨부 표의 7종 관계 데이터를 포함한다. `lib/simulation.mjs`가 독립적인 가상 시나리오를 계산한다. 전체 관계와 계산은 [프로토타입 데이터](prototype-data.md)에 기록한다.
- `public/data/parts-inventory-empty.json`: `meta.dataKind="unregistered"`. 미등록 6·7기통 배치만 제공하고, 공급·재고·협력사 평가를 비운다. 모든 미확인 수량은 `null`; 0재고·초록 상태로 대체하지 않는다.
- `public/data/parts-inventory-demo.json`: 이전 통합 단계의 가상 예시이며 회귀 검사 자료로 보존한다. 현재 기본 화면에서는 사용하지 않는다. 공급 row의 가상 품목번호는 `DEMO-`로 구분한다.
- 선택적 실제 등록: `meta.dataKind="registered", sample=false, source="승인된 입력 출처"` 및 같은 schema를 사용한다. 전체 JSON 검증을 통과한 후 교체한다. 시연 식별자, SAMPLE 출처, 가상 평가를 metadata만 바꿔 실제 등록 상태로 전환할 수 없다.

`UNREGISTERED-6`, `UNREGISTERED-7`은 실제 생산 호기 번호가 아닌 미등록 배치 슬롯이다. `DEMO-6A`, `DEMO-7B`도 가상 시연 호기이다.

## 부품 식별과 명시적 분류 연결

`createCatalog(engine.metadata, sources)`는 geometry의 안정적인 `partId`를 `id`/`part_instance_id`에 그대로 보존한다. `part_type_id`는 이 통합본의 개념 모델 분류이며 실제 구매 품목번호와 다르다. 예를 들어 `CYL01_LINER`는 두 시연 호기에서 서로 다른 가상 품목번호·REV·공급업체를 가질 수 있다.

| Geometry category | 새 분류 ID | 기존 SAMPLE 유형 참조 |
| --- | --- | --- |
| liner | G95_CONCEPT_LINER | LINER |
| cover | G95_CONCEPT_COVER | COVER |
| valve | G95_CONCEPT_EXHAUST_ASSEMBLY | EXHAUST_VALVE |
| frame | G95_CONCEPT_FRAMEBOX | ENGINE_FRAME |
| bedplate | G95_CONCEPT_BEDPLATE | ENGINE_BEDPLATE |
| housing / spindle / seat | G95_CONCEPT_EXHAUST_HOUSING / SPINDLE / SEAT | 없음 |
| pipe | G95_CONCEPT_HYDRAULIC_PIPE | 없음 |
| mbs | G95_CONCEPT_MBS | 없음 |
| shell | G95_CONCEPT_BEARING_SHELL | 없음 |
| cylinderFrame | G95_CONCEPT_CYLINDER_FRAME | 없음 |

위 표의 마지막 열은 이전 `parts-inventory-demo.json`의 **가상 유형 참조**이다. 기존 SAMPLE의 재고 수량·재질·도면번호를 보여주던 연결이며 현재 기본 시연에는 사용하지 않는다. 새 `prototype-simulation.json`은 12개 분류 모두 별도의 가상 품목을 생성한다. 어느 데이터도 G50에서 G95로의 실제 적용, 도면 승인, 재질·규격, 장착 가능성을 뜻하지 않는다.

기존 `ENGINE_MAIN_BEARING_*` SAMPLE 항목은 지지대와 베어링 표현이 혼재해 새 MBS나 쉘로 연결하지 않았다. 신형 geometry의 MBS와 쉘은 독립 ID를 유지하며 기존 재고나 공급업체를 자동 연결하지 않는다.

6기통 catalog는 64개, 7기통 catalog는 74개 선택 가능한 식별 객체를 갖는다. 공유 구조 2개, 지지 위치별 MBS·쉘 2개씩, 기통별 8개 객체이다. 수량은 모델 객체 수이며 구매 필요량을 뜻하지 않는다.

## 재고 범위와 호기 공급 범위

```text
inventory.types[part_type_id].variants[]
  variant_id, drawing_no, rev, material, stock_qty, safety_stock, unit, warehouse

supply[]
  unitId, partId, supplierId, status, itemNo, rev,
  required, available, allocated, shortage, poNo, openOrder,
  requiredDate, expectedDate, reason, updatedAt, variantId, supplyRole
```

`inventory`는 유형 공용 창고 수량이다. `supply`는 정확한 호기·공간 위치에 대한 승인된 입력 값이다. 전역 유형 재고를 모든 기통에 복제해 가용·배정 수량으로 만들지 않는다. adapter는 실제 재고 계산·부족량 계산·계약 조회를 수행하지 않는다. `shortage`도 공급 데이터가 명시한 값만 표시하며 미등록 값은 `null`을 유지한다. 시연 JSON의 부족량은 명시한 가상 시나리오 값이다.

시연 JSON의 `variantId` 연결도 가상 적용 가정이다. API는 해당 variant에 `hypothetical_assignment=true`를 붙인다. `assigned`는 화면에서 현재 가상 참조를 구별하는 의미이며 승인 적용을 뜻하지 않는다.

`getSupplierPartIds(data, unitId, supplierId)`는 정확한 공급 row에 있는 `partId`만 반환한다. 같은 라이너 유형 전체, 원본 협력사의 `scope` 문구, 다른 호기의 공급 관계를 강조 대상으로 확장하지 않는다. 최신 가상 한빛정밀은 A호기 라이너 6개, B호기 커버 7개에 연결된다. 같은 위치라도 호기 변경 후 데이터가 달라지는 검증 사례이다.

현재 schema는 한 호기의 한 `partId`에 한 직접 공급 row를 허용한다. 복수 계약·대체 공급업체 후보·개별 발주 라인 분할은 별도 데이터 schema 확장이 필요하다. 최신 협력사 카드의 등급·납기 준수율·리드타임은 새로 생성한 가상 값이며 실제 업체 평가가 아니다.

## BOM 집계 정책

- 기본 시연은 배기밸브 컴플리트 구매이다. 조립체 ID와 하우징·스핀들·시트 ID는 모두 선택할 수 있지만 구매 위치 집계는 조립체만 포함한다.
- `bomPolicies.exhaustValvePurchaseMode[unitId]="children"`이면 하위품을 집계하고 조립체를 제외한다.
- 이 개념 모델의 MBS는 베드플레이트 통합 지지 영역이다. `bedplateIncludesMbs=true`에서 베드 구매에 포함하여 별도 중복 집계하지 않는다. 별도 ID가 탈착 가능한 구조라는 뜻은 아니다.
- 쉘과 실린더 프레임은 연결 문맥 객체이며 구매 위치 집계에서 제외한다. 승격하려면 실제 구매 단위와 적용 근거를 등록해야 한다.
- `getBomRows`와 `summarizeSupply`는 위 정책을 적용한다. 미등록 필요량을 geometry 개수로 채우거나 0으로 합산하지 않는다. summary의 상태 개수는 수량이 아닌 구매 위치 수이다.

## API

| 함수 | 반환 내용 |
| --- | --- |
| createCatalog(metadata, sources) | 화면용 부품 배열, 정확도·출처·상하위 관계 보존 |
| getSupply(data, unitId, partOrId) | exact 공급 row 또는 모든 수량 `null`인 `unknown` row |
| getPartSuppliers(data, unitId, partOrId) | 그 위치 공급 row에 연결된 협력사 배열 |
| getSupplierPartIds(data, unitId, supplierId) | 그 호기의 exact 강조 ID 배열 |
| getInventoryForPart(data, unitId, catalogPart) | 유형 재고 variants·유형 합계·범위 설명·명시 참조 ID |
| getBomRows(data, unitId, catalog) | 중복 제외 구매 위치와 공급 row |
| summarizeSupply(data, unitId, catalog) | 상태별 구매 위치 개수 및 알려진 필요량 합계 |
| validateData(data, catalog?) | `{valid, errors, warnings}` |

모든 조회 함수는 동기 함수이며 원본을 변경하지 않는다. JSON을 읽는 위치는 화면 계층이 결정한다. `sources`는 `public/data/model-sources.json`의 출처 배열을 전달할 수 있다.

검증은 schema, 중복 관계, exact 부품 ID 패턴, 기통·지지 위치 범위, 협력사·variant 참조, 음수·미확인 수량, 배정량 범위, 확보 상태의 수량 근거, 실제 달력 날짜, 시연값의 실제 등록 전환을 확인한다. 이는 외부 데이터의 진실성이나 도면 적용 승인을 검증하는 기능이 아니다.

## 실행한 검증

`node --test checks/parts-inventory.mjs`

17개 검증에서 6/7기통 ID, 선택 위치별 공급 관계, 호기별 품목·REV 차이, 미등록 수량 유지, 유형 재고와 호기 가용량 분리, 상하위 구매 단위 중복 방지, SAMPLE 사용 한계, 잘못된 import 차단을 확인한다.

실제 운영에는 생산 호기 마스터, 승인된 품목·REV 적용표, 공급 계약과 발주 라인, 창고·검사·가용재고·호기 배정 자료, 필요일·확정 납기, 실제 구매 단위, MBS 설계 및 조립 관계 자료가 추가로 필요하다.
