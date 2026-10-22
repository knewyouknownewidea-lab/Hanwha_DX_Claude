"""Embed the workbook-derived document corpus, persist it, and search it.

The browser never contacts this service directly. The chatbot backend resolves
scope, passes an explicit allowlist, validates every returned source, and keeps
ERP calculations in its existing deterministic tools. No generation API key is
needed for embeddings or Chroma.
"""
from __future__ import annotations

import argparse
from contextlib import asynccontextmanager
from hashlib import sha256
import hmac
import json
import logging
import os
from pathlib import Path
import re
from threading import RLock
import time

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")

import chromadb
from chromadb.config import Settings
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ConfigDict
from rag_service.embeddings import load_embedding

ROOT = Path(__file__).resolve().parents[1]
STATE = Path(os.environ.get("RAG_STATE_DIR", ROOT / ".rag-state"))
MODEL_NAME = os.environ.get("RAG_MODEL_NAME", "intfloat/multilingual-e5-small")
MODEL_REVISION = os.environ.get("RAG_MODEL_REVISION") or ("614241f622f53c4eeff9890bdc4f31cfecc418b3" if MODEL_NAME == "intfloat/multilingual-e5-small" else None)
DATASET = Path(os.environ.get("RAG_DATASET_PATH", ROOT / "data/mock-data.json"))
TOKEN = os.environ.get("RAG_SERVICE_TOKEN", "").strip()
log = logging.getLogger("supplier-rag")


def corpus_fingerprint(documents: list[dict]) -> str:
    # Matches SHA256(JSON.stringify(data.documents)) in the TypeScript backend.
    return sha256(json.dumps(documents, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")).hexdigest()


def source_chunks(document: dict) -> list[dict]:
    if document.get("chunks"):
        return document["chunks"]
    raise ValueError("Explicit workbook chunks are required. Re-run import-revision.py before indexing.")


class CorpusIndex:
    def __init__(self, dataset: Path = DATASET, state: Path = STATE, model_name: str = MODEL_NAME):
        self.dataset = dataset
        self.state = state
        self.model_name = model_name
        self.lock = RLock()
        data = json.loads(dataset.read_text(encoding="utf-8"))
        if data.get("meta", {}).get("synthetic") is not True:
            raise ValueError("Only the explicit synthetic demo corpus is supported.")
        self.documents = data["documents"]
        self.document_ids = {d["id"] for d in self.documents}
        if len(self.document_ids) != len(self.documents):
            raise ValueError("Duplicate document IDs.")
        self.fingerprint = corpus_fingerprint(self.documents)
        self.records = []
        seen = set()
        for document in self.documents:
            for chunk in source_chunks(document):
                if chunk["id"] in seen or not chunk["body"].strip():
                    raise ValueError("Invalid chunk ID or empty text.")
                if document["body"][chunk["char_start"]:chunk["char_end_exclusive"]] != chunk["body"]:
                    raise ValueError("A chunk does not match its exact source offsets.")
                seen.add(chunk["id"])
                self.records.append({"id": chunk["id"], "text": chunk["body"], "document": document})
        state.mkdir(parents=True, exist_ok=True)
        log.info("Loading multilingual embedding model %s on CPU", model_name)
        self.model = load_embedding(model_name, MODEL_REVISION, state)
        # Never silently truncate evidence in a changed corpus.
        passages = [f"passage: {r['document']['title']}\n{r['text']}" for r in self.records]
        if any(self.model.token_count(t) > 512 for t in passages):
            raise ValueError("A source chunk exceeds 512 tokens; split the workbook chunks before indexing.")
        self.client = chromadb.PersistentClient(path=str(state / "chroma"), settings=Settings(anonymized_telemetry=False, allow_reset=False))
        # Quantized and full precision vectors must never share a persisted
        # collection, even though they use the same pinned model and corpus.
        identity = f"{model_name}@{MODEL_REVISION or 'main'}"
        if self.model.backend != "sentence-transformers":
            identity += f"/{self.model.backend}"
        model_hash = sha256(identity.encode()).hexdigest()[:10]
        self.collection_name = f"supplier_{self.fingerprint[:18]}_{model_hash}"
        self.collection = self.client.get_or_create_collection(
            self.collection_name, embedding_function=None,
            configuration={"hnsw": {"space": "cosine"}},
            metadata={"model": model_name, "corpus_fingerprint": self.fingerprint, "synthetic": True},
        )
        existing = self.collection.get(include=["documents", "metadatas"])
        indexed = {key: value for key, value in zip(existing["ids"], existing.get("documents") or [])}
        indexed_meta = {key: value for key, value in zip(existing["ids"], existing.get("metadatas") or [])}
        needs_update = set(indexed) != seen or any(indexed.get(r["id"]) != r["text"] or indexed_meta.get(r["id"], {}).get("document_id") != r["document"]["id"] for r in self.records)
        if needs_update:
            log.info("Embedding and indexing %d source chunks", len(self.records))
            vectors = self.model.encode(passages, batch_size=16).tolist()
            self.collection.upsert(
                ids=[r["id"] for r in self.records],
                documents=[r["text"] for r in self.records],
                embeddings=vectors,
                metadatas=[{"document_id": r["document"]["id"], "title": r["document"]["title"], "type": r["document"]["type"], "created_at": r["document"]["created_at"], "page": r["document"]["page"]} for r in self.records],
            )
            stale = set(indexed) - seen
            if stale:
                self.collection.delete(ids=sorted(stale))
        self.indexed_chunks = self.collection.count()
        if self.indexed_chunks != len(self.records):
            raise ValueError("Stored index count does not match the corpus.")
        # Warm up query inference before reporting ready.
        self.model.encode(["query: 협력사 품질 납기 가격"])
        log.info("Ready: %d documents / %d chunks / persisted Chroma", len(self.documents), self.indexed_chunks)

    def status(self):
        return {"ready": True, "engine": "chroma", "model": self.model_name,
                "indexedChunks": self.indexed_chunks, "documents": len(self.documents),
                "corpusFingerprint": self.fingerprint, "collection": self.collection_name,
                "embeddingDimension": self.model.dimension(), "embeddingBackend": self.model.backend,
                "strategy": "cosine-vector", "synthetic": True, "modelRevision": MODEL_REVISION}

    def search(self, query: str, allowed: list[str], limit: int, fingerprint: str | None = None):
        query = query.strip()
        if not query:
            raise HTTPException(422, "검색 질문을 입력해 주세요.")
        if self.model.token_count(f"query: {query}") > 512:
            raise HTTPException(422, "검색 질문이 너무 깁니다. 핵심 검색어를 512토큰 이내로 줄여 주세요.")
        if fingerprint and not hmac.compare_digest(fingerprint, self.fingerprint):
            raise HTTPException(409, "문서 원천과 벡터 인덱스가 다릅니다. 원천 동기화 후 검색 서비스를 다시 시작해 주세요.")
        if any(value not in self.document_ids for value in allowed):
            raise HTTPException(400, "허용 문서 목록에 등록되지 않은 ID가 있습니다.")
        if not allowed:
            return {**self.status(), "matches": []}
        allowed_set = set(allowed)
        candidates = sum(r["document"]["id"] in allowed_set for r in self.records)
        if not candidates:
            return {**self.status(), "matches": []}
        started = time.perf_counter()
        with self.lock:
            vector = self.model.encode([f"query: {query}"]).tolist()
            result = self.collection.query(query_embeddings=vector,
                where={"document_id": {"$in": sorted(allowed_set)}},
                n_results=min(candidates, limit), include=["documents", "metadatas", "distances"])
        matches = []
        for chunk_id, body, metadata, distance in zip(result["ids"][0], result["documents"][0], result["metadatas"][0], result["distances"][0]):
            if metadata["document_id"] not in allowed_set:
                raise RuntimeError("Chroma returned a document outside the allowed scope.")
            matches.append({"chunk_id": chunk_id, "document_id": metadata["document_id"], "text": body,
                "distance": float(distance), "score": max(-1.0, min(1.0, 1.0-float(distance)))})
        return {**self.status(), "matches": matches, "queryMs": round((time.perf_counter()-started)*1000, 1)}


index: CorpusIndex | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global index
    index = CorpusIndex()
    yield

app = FastAPI(title="Supplier Demo - Embeddings + Chroma", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

@app.middleware("http")
async def protect(request: Request, call_next):
    # Cloud load balancers only need readiness, never corpus/model metadata.
    public_readiness = request.method == "GET" and request.url.path == "/ready"
    if TOKEN and not public_readiness:
        incoming = request.headers.get("authorization", "")
        if not hmac.compare_digest(incoming.encode("utf-8"), f"Bearer {TOKEN}".encode("utf-8")):
            return JSONResponse({"detail": "검색 서비스 인증이 필요합니다."}, status_code=401)
    try:
        content_length = int(request.headers.get("content-length", "0"))
    except ValueError:
        return JSONResponse({"detail": "Invalid content length."}, status_code=400)
    if content_length > 40000:
        return JSONResponse({"detail": "Request is too large."}, status_code=413)
    if request.method == "POST" and len(await request.body()) > 40000:
        return JSONResponse({"detail": "Request is too large."}, status_code=413)
    return await call_next(request)


class SearchBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=1, max_length=8192)
    allowed_document_ids: list[str] = Field(max_length=500)
    limit: int = Field(default=6, ge=1, le=24)
    corpus_fingerprint: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


@app.get("/health")
def health():
    if index is None:
        raise HTTPException(503, "색인을 준비하고 있습니다.")
    return index.status()


@app.get("/ready")
def readiness():
    if index is None:
        raise HTTPException(503, "색인을 준비하고 있습니다.")
    return {"ready": True}


@app.post("/search")
def search(body: SearchBody):
    if index is None:
        raise HTTPException(503, "색인을 준비하고 있습니다.")
    return index.search(body.query.strip(), body.allowed_document_ids, body.limit, body.corpus_fingerprint)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8001, type=int)
    parser.add_argument("--index-only", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpx2").setLevel(logging.WARNING)
    if args.index_only:
        print(json.dumps(CorpusIndex().status(), ensure_ascii=False))
        return
    if args.host not in {"127.0.0.1", "localhost", "::1"} and not TOKEN:
        raise SystemExit("Set RAG_SERVICE_TOKEN before binding a network interface.")
    import uvicorn
    uvicorn.run(app, host=args.host, port=args.port, log_level="info", access_log=False)


if __name__ == "__main__":
    main()
