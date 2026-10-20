# engine-dx-inventory

통합판의 현재 실행 방법·화면·모델 연결은 [README_INTEGRATED.md](./README_INTEGRATED.md)에 정리했습니다. 아래 내용은 통합 전 재고 화면의 기능과 SAMPLE 데이터 기록입니다.

engine-dx를 부품 재고와 협력사 강조 화면으로 수정한 판입니다. 원본 `engine-dx` 폴더는 그대로 두었습니다.

## 원본 대비 변경
- 협의 기능 화면 제거
- `public/data/inventory.json`, `public/data/suppliers.json` 가상 데이터 추가
- `EngineViewer`에 `highlightIds` 추가 (협력사 강조: 선택 협력사 부품 발광, 나머지 반투명)
- 검사 스크립트 `checks/inventory.mjs`, `checks/suppliers.mjs` 추가
- 부품 선택 시 재고·도면번호·재질별 세부 항목과 생산 협력사 목록(등급·납기 준수율) 표시

## 실행
`docs/engine-dx-standalone-run.md` 참조 (Node 22.13 이상, pnpm 11.25).

## 주의
- 모든 재고·협력사 값은 SAMPLE 가상 데이터이며 실제 자료가 아닙니다.
- 3D 모델은 단순화한 시연용이며 실제 도면이 아닙니다.
- 다른 플랫폼에 이식할 때의 요구 사항은 `docs/engine-viewer-platform-integration-requirements.md` 참조.
