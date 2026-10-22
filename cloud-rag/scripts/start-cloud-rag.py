"""Run the authenticated, single-process retrieval API on the host's port."""
from __future__ import annotations

import os
from pathlib import Path
import sys


def main():
    token = os.environ.get("RAG_SERVICE_TOKEN", "").strip()
    if len(token) < 32:
        raise SystemExit("Set a private RAG_SERVICE_TOKEN of at least 32 characters in the hosting environment.")
    try:
        port = int(os.environ.get("PORT", "10000"))
    except ValueError:
        raise SystemExit("PORT must be an integer.") from None
    if not 1 <= port <= 65535:
        raise SystemExit("PORT must be between 1 and 65535.")
    root = Path(__file__).resolve().parents[1]
    os.chdir(root)
    # exec keeps the actual HTTP server as the container's signal recipient.
    # The credential stays in the environment, never in arguments or output.
    os.execv(sys.executable, [sys.executable, "-m", "rag_service.server", "--host", "0.0.0.0", "--port", str(port)])


if __name__ == "__main__":
    main()
