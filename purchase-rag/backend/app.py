"""브라우저/Java 백엔드가 호출할 HTTP API입니다."""
from functools import lru_cache
from typing import Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel, Field, field_validator
from .service import RagService
from .prompting import build_prompt
from .generation import OllamaGenerator, GenerationError

app = FastAPI(title='구매관리 RAG 백엔드', version='1.3.0',
              description='로컬 테스트용. 정확 조회는 원본 DB, 민원 내용은 BGE-M3/Chroma로 검색합니다. /answer에서 생성 모델을 선택하면 Ollama로 답변과 출처를 반환합니다. 근거 부족·모호한 질문은 모델 호출 전에 처리합니다.')
app.add_middleware(TrustedHostMiddleware, allowed_hosts=['127.0.0.1','localhost','testserver'])

@lru_cache
def service():
    return RagService()

@lru_cache
def generator():
    return OllamaGenerator()

class SearchRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000, examples=['베어링 완충 포장이 부족하다는 민원을 찾아줘'])
    top_k: int = Field(default=3, ge=1, le=10)
    order_id: int | None = Field(default=None, gt=0, description='발주 번호를 정확히 지정할 때 사용')
    supplier_id: int | None = Field(default=None, gt=0)
    part_id: int | None = Field(default=None, gt=0)
    document_type: Literal['supplier','part','supplier_part','order','complaint'] | None = None

    @field_validator('question')
    @classmethod
    def not_blank(cls, value):
        value = value.strip()
        if not value:
            raise ValueError('질문을 입력하세요.')
        return value

class AnswerRequest(SearchRequest):
    model: Literal['qwen3:8b', 'gemma3:4b', 'llama3.1:8b'] = Field(
        description='사용할 생성 모델을 직접 선택하세요. 기본 모델은 지정하지 않습니다.',
        examples=['gemma3:4b'])

def execute(fn):
    try:
        return fn()
    except GenerationError as error:
        raise HTTPException(status_code=error.status_code,
                            detail={'message':str(error), 'model_called':error.model_called}) from error
    except LookupError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

@app.get('/health', summary='서버 실행 여부 확인')
def health():
    return {'status': 'ok'}

@app.get('/status', summary='저장된 벡터 개수와 원본 변경 여부')
def status():
    return execute(lambda: service().status())

@app.post('/index', summary='DB 조회부터 벡터 DB 저장까지 실행')
def index():
    return execute(lambda: service().index())

@app.post('/search', summary='조건 검증 후 DB 정확 조회 또는 벡터 검색')
def search(request: SearchRequest):
    filters = request.model_dump(exclude={'question','top_k'}, exclude_none=True)
    return execute(lambda: service().search(request.question, request.top_k, filters))

@app.post('/prepare-prompt', summary='질문·검색 근거·출처 통합 (답변 생성 없음)')
def prepare_prompt(request: SearchRequest):
    filters = request.model_dump(exclude={'question','top_k'}, exclude_none=True)
    return execute(lambda: build_prompt(service().search(request.question, request.top_k, filters)))

@app.get('/models', summary='선택 가능한 생성 모델과 설치 여부')
def models():
    return execute(lambda: generator().models())

@app.post('/answer', summary='검색 근거로 Ollama 답변 생성 및 출처 반환')
def answer(request: AnswerRequest):
    filters = request.model_dump(exclude={'question','top_k','model'}, exclude_none=True)
    return execute(lambda: generator().answer(
        service().search(request.question, request.top_k, filters), request.model))
