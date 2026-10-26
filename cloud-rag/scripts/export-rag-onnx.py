"""Prepare the official pinned dynamic-int8 E5 ONNX export at image build time.

The model publisher already exports and dynamically quantizes this exact E5
revision. Reuse that reproducible, hash-verified artifact rather than shipping
PyTorch or running an exporter on a free runtime. Despite the upstream AVX512
filename, ONNX Runtime's CPU provider also runs the graph on other supported
CPUs (performance depends on the host instruction set).
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
from urllib.request import urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from rag_service.embeddings import E5_MODEL, E5_REVISION, ONNX_SHA256, TOKENIZER_SHA256, SENTENCEPIECE_SHA256


def prepare(output: Path):
    output.mkdir(parents=True, exist_ok=True)
    for remote, filename, expected in [
        ("onnx/model_qint8_avx512_vnni.onnx", "model.onnx", ONNX_SHA256),
        ("onnx/tokenizer.json", "tokenizer.json", TOKENIZER_SHA256),
        ("sentencepiece.bpe.model", "sentencepiece.bpe.model", SENTENCEPIECE_SHA256),
    ]:
        target = output / filename
        if target.is_file():
            digest = sha256()
            with target.open("rb") as handle:
                for block in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(block)
            if digest.hexdigest() == expected:
                print(f"Verified cached {filename}", flush=True)
                continue
        temporary = target.with_suffix(target.suffix + ".part")
        digest = sha256()
        url = f"https://huggingface.co/{E5_MODEL}/resolve/{E5_REVISION}/{remote}"
        with urlopen(url, timeout=180) as response, temporary.open("wb") as handle:
            while block := response.read(1024 * 1024):
                digest.update(block)
                handle.write(block)
        if digest.hexdigest() != expected:
            temporary.unlink(missing_ok=True)
            raise ValueError(f"Pinned asset SHA256 mismatch: {filename}")
        temporary.replace(target)
        print(f"Downloaded and verified {filename}", flush=True)
    manifest = {
        "model": E5_MODEL, "revision": E5_REVISION,
        "upstream_file": "onnx/model_qint8_avx512_vnni.onnx",
        "quantization": "upstream dynamic int8", "pooling": "attention-mask mean", "normalized": True,
        "model_sha256": ONNX_SHA256, "tokenizer_sha256": TOKENIZER_SHA256,
        "sentencepiece_sha256": SENTENCEPIECE_SHA256,
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output.resolve()), "model": E5_MODEL, "revision": E5_REVISION, "runtime": "onnx-int8"}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / ".rag-state/onnx")
    args = parser.parse_args()
    prepare(args.output)
