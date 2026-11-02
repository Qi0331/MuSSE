#!/usr/bin/env python3
"""Check the repository documentation skeleton; NOT a firmware/hardware test."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    "README.md", "AGENTS.md", "CONTRIBUTING.md", "SECURITY.md",
    "docs/STATUS.md", "docs/HARDWARE.md", "docs/UPSTREAM.md",
    "docs/ARCHITECTURE.md", "docs/ROADMAP.md", "docs/DECISIONS.md",
    "docs/REFERENCES.md",
    "docs/TEST_LOG.md", "docs/HANDOFF.md",
    ".github/PULL_REQUEST_TEMPLATE.md", ".github/copilot-instructions.md",
    ".github/workflows/docs-check.yml",
]

def main():
    missing = [p for p in REQUIRED if not (ROOT / p).is_file()]
    if missing:
        print("FAIL: missing files:\n" + "\n".join(missing))
        return 1

    status = (ROOT / "docs/STATUS.md").read_text(encoding="utf-8")
    missing_status = [
        key for key in ["最后更新", "阶段", "下一步", "尚未验证"]
        if key not in status
    ]
    if missing_status:
        print("FAIL: missing STATUS fields: " + ", ".join(missing_status))
        return 1

    print("PASS: required repository documents and STATUS fields exist")
    print("NOTE: no firmware, hardware, API, or real-device tests were run")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
