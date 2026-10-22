# 협력사 평가 시연용 검색 서버

Sites의 웹·엑셀 계산 서버에서 호출하는 인증된 Python 검색 API입니다. 가상 문서 21개와 원문 청크만 포함합니다.

- 모델: intfloat/multilingual-e5-small / 공식 동적 int8 ONNX / 384차원
- 벡터 저장·검색: Chroma / 코사인 유사도 / 문서 ID allowlist
- 코퍼스 SHA256: `fe4af121aebb758e452e4f6a587d3e7a8904d3338a60e52949fa4c3c79137f06`
- 배포: Render Free, Dockerfile, health check `/ready`, 포트 `PORT`
- 필수 비밀: `RAG_SERVICE_TOKEN` (32자 이상, 서버 환경변수에만 설정)
- `/health`·`/search`는 같은 Bearer 토큰으로 보호합니다.
- 무료 서버는 15분 미사용 시 절전하며, 다음 요청으로 다시 시작합니다. 절전 없는 상시 응답은 보장하지 않습니다.
- 모델은 이미지에 포함하고, 임시 Chroma 파일이 사라져도 포함된 정본 문서로 색인을 재생성합니다. 실행 중 사용자가 수정한 데이터의 영구 보존 기능은 없습니다.
- 생성형 응답을 위한 Gemini 키는 별도이며 이 검색 서버에는 필요하지 않습니다.

클라우드 배포 뒤 Sites의 RAG_SERVICE_URL·RAG_SERVICE_TOKEN을 설정하고, PC의 Python·터널을 중지한 상태에서 실제 벡터 검색과 엑셀 계산을 검증해야 이전이 완료됩니다.

공식 운영 조건: https://render.com/docs/free
