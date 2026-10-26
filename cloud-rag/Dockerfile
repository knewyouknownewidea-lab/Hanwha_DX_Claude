FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TOKENIZERS_PARALLELISM=false \
    ANONYMIZED_TELEMETRY=False \
    RAG_EMBEDDING_BACKEND=onnx \
    RAG_ONNX_MODEL_DIR=/opt/rag-model \
    RAG_STATE_DIR=/tmp/supplier-rag \
    RAG_DATASET_PATH=/app/data/mock-data.json \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MALLOC_ARENA_MAX=2

WORKDIR /app
COPY requirements-rag-cloud.txt ./
RUN pip install --no-cache-dir -r requirements-rag-cloud.txt

# These public, pinned model files are immutable image artifacts. Runtime
# restarts therefore do not download models or depend on the developer PC.
COPY rag_service/embeddings.py ./rag_service/embeddings.py
COPY scripts/export-rag-onnx.py ./scripts/export-rag-onnx.py
RUN python scripts/export-rag-onnx.py --output /opt/rag-model

COPY rag_service ./rag_service
COPY scripts/start-cloud-rag.py ./scripts/start-cloud-rag.py
COPY data/mock-data.json ./data/mock-data.json

RUN useradd --create-home --uid 10001 rag
USER rag
EXPOSE 10000
CMD ["python", "scripts/start-cloud-rag.py"]
