# 외부 코드·자료 고지

## Three.js

- 패키지: `three` 0.180.0
- 원본: [Three.js](https://github.com/mrdoob/three.js)
- 라이선스: MIT
- 저작권 고지: Copyright © 2010-2025 three.js authors
- 포함 범위: 렌더링 코어, `OrbitControls`, `GLTFExporter`.

`npm run build`는 설치된 패키지의 원문 LICENSE를 `dist/vendor/three/LICENSE`로 복사한다. 이 라이선스와 저작권 고지를 정적 배포 및 기존 저장소 통합 시 유지해야 한다. 개발 설치의 원문은 `node_modules/three/LICENSE`에 있다. 이 고지는 Three.js에만 적용되며 사용자 저장소 전체를 MIT로 전환하지 않는다.

## 외부 3D·제품 참고자료

Sketchfab 후보 A, CGTrader 후보 B, Ship_engine 후보 C, 추가 포트폴리오 후보의 CAD·GLB·소스 코드·문서 파일을 이 프로젝트에 포함하지 않았다. B의 no AI 표시를 준수해 모델·이미지를 입력하지 않았다. C의 proprietary LICENSE를 허용적 라이선스로 취급하지 않았다.

MAN/Everllence 공식 포스터, 제조사 사진, 공시, 특허는 [출처·정확도 기록](./docs/sources-and-accuracy.md)에서 링크와 독자 요약만 제공한다. 공개 열람 가능성으로 수정·재배포 권한이 생긴다고 가정하지 않았다. 해당 자료의 원문 PDF·사진·도면을 배포물에 포함하지 않는다.

부품 모델의 JavaScript·메시·SVG는 이 작업에서 독립 작성한 개념 시각화다. 사용자의 기존 코드와 새 모듈에 별도의 오픈소스 라이선스를 임의 부여하지 않았다. 기존 권리자의 권리를 유지하며, 향후 라이선스 지정은 프로젝트 권리자가 결정한다.
