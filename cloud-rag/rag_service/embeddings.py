"""Embedding runtimes with identical E5 prefixes, pooling and normalization.

The ONNX runtime deliberately does not import torch or transformers. Its pinned,
upstream dynamic-int8 export is prepared at image build time, never downloaded
on an incoming search request.
"""
from __future__ import annotations

from hashlib import sha256
import json
import os
from pathlib import Path
import re

E5_MODEL = "intfloat/multilingual-e5-small"
E5_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3"
ONNX_SHA256 = "dd476dd0c2514e9b9be83aeb3853fac0763e0bdf4a71645407587d77c48a2d88"
TOKENIZER_SHA256 = "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39"
SENTENCEPIECE_SHA256 = "cfc8146abe2a0488e9e2a0c56de7952f7c11ab059eca145a0a727afce0db2865"


class E5SentencePieceTokenizer:
    """XLM-R token IDs using the publisher's compact SentencePiece vocabulary.

    Rust's fast tokenizer temporarily parses a large JSON vocabulary. The
    native SentencePiece form implements the same XLM-R vocabulary/normalizer
    in substantially less resident memory. Match the fast tokenizer's special
    tokens and retained trailing metaspace explicitly.
    """
    special = {"<s>": 0, "<pad>": 1, "</s>": 2, "<unk>": 3, "<mask>": 250001}
    split_special = re.compile(r"(<s>|<pad>|</s>|<unk>|<mask>)")

    def __init__(self, path: Path):
        import sentencepiece
        self.processor = sentencepiece.SentencePieceProcessor(model_file=str(path))
        self.normalizer = sentencepiece.SentencePieceNormalizer(
            model_file=str(path), add_dummy_prefix=False,
            escape_whitespaces=False, remove_extra_whitespaces=False,
        )

    def encode(self, text: str) -> list[int]:
        result = [0]
        for part in self.split_special.split(text):
            if not part:
                continue
            if part in self.special:
                result.append(self.special[part])
                continue
            normalized = re.sub(" {2,}", " ", self.normalizer.normalize(part))
            pieces = self.processor.encode(normalized)
            result.extend(3 if piece == 0 else piece + 1 for piece in pieces)
            # The fast tokenizer keeps one trailing whitespace marker after
            # nonempty text; SentencePiece otherwise trims it during normalize.
            if normalized.endswith(" "):
                result.append(6)
        return result + [2]


class SentenceTransformerEmbedding:
    backend = "sentence-transformers"

    def __init__(self, model_name: str, revision: str | None, state: Path):
        from sentence_transformers import SentenceTransformer
        import torch

        torch.set_num_threads(max(1, min(4, os.cpu_count() or 1)))
        self.model = SentenceTransformer(model_name, cache_folder=str(state / "models"), device="cpu", revision=revision)
        self.model.max_seq_length = 512

    def token_count(self, text: str) -> int:
        return len(self.model.tokenizer.encode(text, add_special_tokens=True))

    def encode(self, texts: list[str], batch_size: int = 16):
        return self.model.encode(texts, batch_size=batch_size, normalize_embeddings=True, show_progress_bar=False)

    def dimension(self) -> int:
        return int(self.model.get_sentence_embedding_dimension())


class OnnxEmbedding:
    backend = "onnx-int8"

    def __init__(self, model_name: str, revision: str | None, state: Path):
        if model_name != E5_MODEL or revision != E5_REVISION:
            raise ValueError("The ONNX runtime requires the explicitly pinned multilingual-e5-small revision.")
        import numpy as np
        import onnxruntime as ort

        self.np = np
        model_dir = Path(os.environ.get("RAG_ONNX_MODEL_DIR", state / "onnx"))
        self.model_path = model_dir / "model.onnx"
        tokenizer_path = model_dir / "sentencepiece.bpe.model"
        manifest_path = model_dir / "manifest.json"
        if not all(p.is_file() for p in [self.model_path, tokenizer_path, manifest_path]):
            raise ValueError("Prepare the pinned ONNX assets with scripts/export-rag-onnx.py before starting the service.")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if (manifest.get("model") != model_name or manifest.get("revision") != revision
                or manifest.get("model_sha256") != ONNX_SHA256
                or manifest.get("tokenizer_sha256") != TOKENIZER_SHA256
                or manifest.get("sentencepiece_sha256") != SENTENCEPIECE_SHA256):
            raise ValueError("The ONNX asset manifest does not match the pinned E5 model.")
        # Stream the large file instead of materializing another 118 MB copy.
        for path, expected in [(self.model_path, ONNX_SHA256), (tokenizer_path, SENTENCEPIECE_SHA256)]:
            digest = sha256()
            with path.open("rb") as handle:
                for block in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(block)
            if digest.hexdigest() != expected:
                raise ValueError("An ONNX model asset failed its pinned SHA256 check.")
        self.tokenizer = E5SentencePieceTokenizer(tokenizer_path)
        options = ort.SessionOptions()
        options.intra_op_num_threads = max(1, min(2, os.cpu_count() or 1))
        options.inter_op_num_threads = 1
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        # A single small corpus and short questions do not need an expanding
        # CPU arena or shape-specific memory-pattern caches on a 512 MB host.
        options.enable_cpu_mem_arena = False
        options.enable_mem_pattern = False
        options.add_session_config_entry("session.disable_prepacking", "1")
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        self.session = ort.InferenceSession(str(self.model_path), sess_options=options, providers=["CPUExecutionProvider"])
        self.input_names = {item.name for item in self.session.get_inputs()}

    def token_count(self, text: str) -> int:
        return len(self.tokenizer.encode(text))

    def encode(self, texts: list[str], batch_size: int = 2):
        vectors = []
        # Keep token activations bounded even when indexing all 21 documents.
        for start in range(0, len(texts), min(batch_size, 2)):
            batch = [self.tokenizer.encode(text) for text in texts[start:start + min(batch_size, 2)]]
            if any(len(item) > 512 for item in batch):
                raise ValueError("Embedding input exceeds 512 tokens.")
            width = max(map(len, batch))
            feeds = {
                "input_ids": self.np.asarray([item + [1] * (width-len(item)) for item in batch], dtype=self.np.int64),
                "attention_mask": self.np.asarray([[1] * len(item) + [0] * (width-len(item)) for item in batch], dtype=self.np.int64),
            }
            if "token_type_ids" in self.input_names:
                feeds["token_type_ids"] = self.np.zeros((len(batch), width), dtype=self.np.int64)
            hidden = self.session.run(None, {key: value for key, value in feeds.items() if key in self.input_names})[0]
            mask = feeds["attention_mask"][..., None].astype(self.np.float32)
            pooled = (hidden * mask).sum(axis=1) / mask.sum(axis=1).clip(min=1)
            pooled /= self.np.linalg.norm(pooled, axis=1, keepdims=True).clip(min=1e-12)
            vectors.append(pooled)
        return self.np.concatenate(vectors, axis=0) if vectors else self.np.empty((0, 384), dtype=self.np.float32)

    def dimension(self) -> int:
        return 384


def load_embedding(model_name: str, revision: str | None, state: Path):
    backend = os.environ.get("RAG_EMBEDDING_BACKEND", "sentence-transformers").strip().lower()
    if backend == "onnx":
        return OnnxEmbedding(model_name, revision, state)
    if backend == "sentence-transformers":
        return SentenceTransformerEmbedding(model_name, revision, state)
    raise ValueError("RAG_EMBEDDING_BACKEND must be sentence-transformers or onnx.")
